#include <signal.h>
#include <libwebsockets.h>
#include <string.h>
#include <stdio.h>
#include <unistd.h>
#include <iostream>
#include <sstream>
#include <assert.h>
#include <thread>
#include <chrono>
#include <map>
#include <string>
using namespace std;

//#include "dart.h"
//static Dart *dart = nullptr;
#include "tracer.h"
#include "ffrservice.h"

//======================общие функции сервиса перехват SIGTEM, окончание сессии и т.д.==============================
// Наличие большого количества глобальных переменных, пусть даже статических, смущает, но ничего лучшего не придумал
//
static FFRServiceUserData _userData = {-1, 0, 0};
static struct lws_context *context = nullptr;       // инициализируется в LWSservice

void terminate_session(string reason) {
    string msg = string("session terminated by reason: "+reason);
    tracer.log(msg);
    if(context) {
        tracer.log("destroying lws_context");
        lws_context_destroy(context);
    }
    unlink("pid.atb");
    tracer.log("exiting..");
    exit(0);
}

void sigterm_handler(int signum) {
    terminate_session(string("получен сигнал ")+std::to_string(signum));
 }
//===============================================================


bool startsWith(const char *str, const char *substr) {
    return strstr(str,substr) == str;
}
// здесь пример: https://medium.com/@martin.sikora/libwebsockets-simple-http-server-2b34c13ab540
//
// управление V5srv через HTTP GET запросы по порту WS HTTP (8889):
// / -> "ok"
// /home/<path-to-doctor-home-dir>
// /doctorLogin/<doctor-login>
// /cmd/<cmd> cmd=logout
// например /home/home/guerman/public_html/V5-dev/data/FF1122/
//
static int callback_http( struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len )
{
    len; in; user,wsi;  // UNUSED
    //printf("callback_http reason=%d\n",reason);
    switch( reason )
    {
    case LWS_CALLBACK_HTTP: {
        char *requested_uri = (char *) in;
        if(strcmp(requested_uri,"/")==0) {
            lws_write(wsi, (unsigned char*)"ok", 2, LWS_WRITE_HTTP);
            return -1;
        }
        // /cmd/logout  ... /cmd/id
        if(startsWith(requested_uri,"/cmd/")) {
//            char *s = strchr(requested_uri+1,'/')+1;
//            dart->process(s);
        }
        string replyStr = "";//dart->reply();
        const char *data = replyStr.c_str();
        printf("lws sending back: %s\n",data);
//        dart->logger()->info("writing back: {}",data);
        lws_write(wsi, (unsigned char *)data, strlen(data), LWS_WRITE_HTTP);
        return -1;      // close connection
    }
    default:
        break;
    }

    return 0;  // close?
}

#define EXAMPLE_RX_BUFFER_BYTES (4096)
struct payload
{
    unsigned char data[LWS_SEND_BUFFER_PRE_PADDING + EXAMPLE_RX_BUFFER_BYTES + LWS_SEND_BUFFER_POST_PADDING];
    size_t len;
} received_payload;
class FFRService;
bool trace_callback_ffr = false;        // для отладки

static std::map<struct lws *, FFRService *> ffr_services;

/*
 * LWS ping-pong https://libwebsockets.org/git/libwebsockets/tree/minimal-examples/ws-client/minimal-ws-client-ping/minimal-ws-client-ping.c?id=7c6e3a8aeb89f989ff4ccb4605736c38220789c5
 */
struct pss {
        int send_a_ping;
};

static int callback_ffr( struct lws *wsi, enum lws_callback_reasons reason, void *user, void *in, size_t len )
{
    struct pss *pss = (struct pss *)user; // для LWS ping-pong
    int n;
    //user;   // UNUSED
    unsigned char *data = (unsigned char *)&received_payload.data[LWS_SEND_BUFFER_PRE_PADDING];
    string replyStr="";
    short *dat = (short *)in; int size = len/sizeof(short);
    string msg; stringstream ss; FFRService *srv=nullptr;
    const int IP_SIZE = 50;
    char client_name [IP_SIZE], client_ip   [IP_SIZE];

    if(trace_callback_ffr) {
        ss.clear(); ss << "LWS_CALLBACK_FFR: reason=" << reason << " pss="<<pss;
        tracer.log(ss.str());
    }

    switch( reason )
    {
    case LWS_CALLBACK_ESTABLISHED:
        lws_get_peer_simple(wsi,client_ip, sizeof(client_ip));
        ss.clear(); ss << "LWS_CALLBACK_ESTABLISHED: adding new FFRService instance for wsi " << wsi;
        ss << " client IP " << client_ip;
        tracer.log(ss.str());

        // lws_get_peer_addresses(wsi, lws_get_socket_fd(wsi), 
        //       client_name, sizeof(client_name), client_ip, sizeof(client_ip));

        //ss.clear(); ss << "next line" << client_ip;//ss << "client: " << client_ip << "(" << client_name << ")";
        //tracer.log(ss.str());

        ffr_services.insert(std::make_pair(wsi,new FFRService(wsi)));
        //tracer.log("FFRINFO: turning on lws PING");
        //lws_set_timer_usecs(wsi, 5 * LWS_USEC_PER_SEC);
        break;

    case LWS_CALLBACK_RECEIVE:
        srv = ffr_services[wsi];
        //ss.clear(); ss << "LWS_CALLBACK_RECEIVE: len="<<len<<" for FFRService "<<srv<<" wsi="<<wsi;
        //tracer.log(ss.str());
        //tracer.logInt("is_binary",lws_frame_is_binary(wsi));

        if(lws_frame_is_binary(wsi))
            srv->frameRecievedBinary(wsi,user,in,len);
        else
            srv->frameRecieved(in,len);

        //lws_callback_on_writable_all_protocol( lws_get_context( wsi ), lws_get_protocol( wsi ) );
        break;

    case LWS_CALLBACK_SERVER_WRITEABLE:
        //tracer.log(string("LWS_CALLBACK_SERVER_WRITEABLE:")+replyStr);
        // если в текущем справочнике появился файл "request-to-stop", то необходимо завершить работу
        // это 2 уровень защиты для автоматически запускаемых ATB
        if(FILE *requestToStop = fopen("request-to-stop","r")) {
            fclose(requestToStop);
            unlink("request-to-stop");
            terminate_session("Detected request-to-stop");
        }

        // это из ссылки выше
        if (pss && pss->send_a_ping) {
                uint8_t ping[LWS_PRE + 125];
                int m;

                pss->send_a_ping = 0;
                n = 0;
                n = lws_snprintf((char *)ping + LWS_PRE, 125,
                        "ping body!");

                lwsl_user("Sending PING %d...\n", n);
                //tracer.log("Sending PING...");

                m = lws_write(wsi, ping + LWS_PRE, n, LWS_WRITE_PING);
                if (m < n) {
                        lwsl_err("sending ping failed: %d\n", m);

                        return -1;
                }
                
                lws_callback_on_writable(wsi);
        }

        // reply() запрашиваем только один раз, следующий запрос вернет ""
//        replyStr = dart->reply();
        if(!replyStr.size()) break;
        assert(replyStr.size() < EXAMPLE_RX_BUFFER_BYTES);
        memcpy(data,replyStr.data(),replyStr.size());
        //lws_write( wsi, data, replyStr.size(), LWS_WRITE_TEXT );
        break;

    case LWS_CALLBACK_CLOSED:
        ss.clear(); ss << "received LWS_CALLBACK_CLOSED for wsi " << wsi;
        tracer.log(ss.str());
        ffr_services.erase(wsi);
        if(ffr_services.size() == 0) 
            terminate_session("no more clients");
        break;

    case LWS_CALLBACK_RECEIVE_PONG:
            // lwsl_user("LWS_CALLBACK_CLIENT_RECEIVE_PONG\n");
            // lwsl_hexdump_notice(in, len);
            break;

    case LWS_CALLBACK_TIMER:
        //tracer.log("case LWS_CALLBACK_TIMER");
        pss->send_a_ping = 1;
        lws_callback_on_writable(wsi);
        lws_set_timer_usecs(wsi, 5 * LWS_USEC_PER_SEC);
        break;

    default:
            break;
    }

    return 0;
}

enum protocols
{
    PROTOCOL_HTTP = 0,
    PROTOCOL_EXAMPLE,
    PROTOCOL_COUNT
};

static struct lws_protocols protocols[] =
{
    /* The first protocol must always be the HTTP handler */
    {
            "http-only",   /* name */
            callback_http, /* callback */
            0,             /* No per session data. */
            0,             /* max frame size / rx buffer */
    },
    {
            "ffr-protocol",
            callback_ffr,
            sizeof(struct pss),
            EXAMPLE_RX_BUFFER_BYTES,    // максимальный размер фрейма 4096 байт
    },
    { NULL, NULL, 0, 0 } /* terminator */
};



void LWSservice()
{
    signal(SIGTERM,sigterm_handler); //sighandler_t sigterm_handler; 

    struct lws_context_creation_info info;
    memset( &info, 0, sizeof(info) );

    info.port = 8889;
    info.protocols = protocols;
    info.gid = -1;
    info.uid = -1;
    info.user = &_userData;

    if(!(context = lws_create_context( &info ))) 
        terminate_session("can't create lws_context");

    stringstream ss; ss<<"server ATB "<< FFRService::version() <<" listening on port "<< info.port;
    tracer.log(ss.str());

    while( 1 )
    {
//        tracer.log("calling lws_service..\n");
        extern FFRService *service;
        if(service)
            service->processUserData(context);

        lws_service( context, /* timeout_ms = */ 1000000 );
//        tracer.log("after lws_service\n");
    }

    terminate_session( "lws_service loop finished" );
}


