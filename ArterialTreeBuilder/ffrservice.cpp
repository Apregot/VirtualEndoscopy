#include "ffrservice.h"
#include "tracer.h"
#include <libwebsockets.h>
#include <cstddef>
#include <string>
#include <vector>
#include <sstream>
#include <fstream>
#include <thread>
#include <chrono>
#include <cassert>
#include <cmath>        // modf
#ifdef __unix__
#include <unistd.h>
#include <sys/wait.h>
#endif
#include <stdlib.h>
#include <iostream>
#include <limits.h>

void printCube(mvox::Cube cube);

using namespace std;

#define Copy(src,dst) FSF::copyArray(src,dst,sizeof(dst))

void FFRService_update_progres(float relativeProgress, const wchar_t* status);  // forward declaration

// Это глобальная ссылка на FFRService для использования callback функциями при вызове FFRProcessor
// Другого способа привязать callback функцию к FFRProcessor'у я не вижу.
// это означает, что LWS, делая вид, что может обслуживать много соединений по вебсокету,
// а технически это так, вводит в заблуждение своим map, что разным контестам wsi могут соответствовать
// разные FFRService'ы. То есть в этой задаче одно соединение == один единственный FFRService,
// которому соответствует единственный FFRProcessor. Другое дело может ли он инициализироваться
// разными FFRSettings, то есть обрабатывать последовательно разные DICOM. Это надо подумать.
// Либо сделать callback функцию методом FFRProcessor, а ему при рождении сказать, с каким FFRService
// он ассоциирован. Но проще, пожалуй, ввести глобальную переменную
// Интересно, что FFRService::sendText() пришлось сделать public из-за этого для использования
// callback функциями
//
FFRService *service = nullptr;

// class FFR Stream Format
class FSF {
public:
    // Дескриптор: LFTTTTDD
    // TTTT - 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64;
    // 8:FString 0xF:TFSF (internal use)
    enum TTTT {Int8=0, Uint8, Int16, Uint16, Int32, Uint32, Float32, Float64, FString, TFSF};
    static const char *typeName(int t) {
        static const char *types[] = {"Int8", "Uint8", "Int16", "Uint16", "Int32", "Uint32", "Float32", "Float64"};
        return (t>=0 && t<sizeof(types)/sizeof(types[0]) ? types[t] : "Unknown");
    }
    struct Array {
        int nDims;  // -1 invalid
        TTTT type;
        int dims[3];
        void *data;
        size_t size() {
            size_t elems = nDims == -1 ? 0 : nDims == 1 ? dims[0] : nDims == 2 ? dims[0]*dims[1] : dims[0]*dims[1]*dims[2];
            return elems * FSF::sizeOf(type);
        }
    };
    struct FSFptr {
        void *ptr;
        size_t len;
    };
    static const unsigned char FSF_UNSUPPORTED = 0x7C;    // : 01TTTT00, TTTT=0xF
    static const int FIN = (1<<6);
    static const int L   = (1<<7);
    static const unsigned char EOS = 0x7C;              // End of Stream
    static const unsigned char PAD = 0x3C;              // PADDING
    static const unsigned char OK  = 0xB8;              // BINARY OK
    static const unsigned char ERR = 0xB9;              // BINARY ERR
    static const unsigned char BITMASK = 0x25;          // 00100101
    static const unsigned char MASKWITHROI = 0x26;      // 00100110
    static const unsigned char BITMASKWITHROI = 0x27;   // 00100111
private:
    static int fin(bool _fin) {return (_fin ? FIN : 0);}
    static size_t round8(size_t n) {return ((n+7)/8)*8;}
    static void roundBuf() {    // добивает буфер PAD-маркером до кратного 8
        unsigned char *buf = service->txbufBin.data + service->txbufBin.offset;
        int numPads = (8-(service->txbufBin.offset % 8))%8;
        for(int i=0; i<numPads; i++)
            buf[i] = FSF::PAD;
        service->txbufBin.offset += numPads;
    }

public:
    // TTTT - 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64;
    static void print(FSF::Array &fa, int lim=16) {
        if(fa.nDims == -1) {printf("FSF::Array invalid\n"); return;}
        if(fa.dims[0] < lim) lim=fa.dims[0];
        printf("FSF::%sArray[%d %d %d]",typeName(fa.type),fa.dims[0],fa.dims[1],fa.dims[2]);
        printf(" data: ");
        if(!fa.data) printf("null\n");
        else {
            if(fa.type == Float32 || fa.type == Float64) {
                float *data = (float *)fa.data;
                for(int i=0; i<lim; i++) {
                    float d=data[i], dummy, frac=modf(d,&dummy);
                    printf(fabs(frac) < 1e-6 ? "%.0f " : "%.3f ",d);
                }
            }
            else if(fa.type == Uint8) {
               uint8_t *data = (uint8_t *)fa.data;
               for(int i=0; i<lim; i++)
                   printf("%d ",data[i]);
            }
            printf("%s\n",fa.dims[0] > lim ? "..." : "");
        }
    }
    static int sizeOf(int t) {
        // TTTT - 0:Int8, 1:Uint8, 2:Int16, 3:Uint16, 4:Int32, 5:Uint32, 6:Float32, 7:Float64;
        return(t==0 || t==1 ? 1: t==2 || t==3 ? 2 : t==4 || t==5 || t==6 ? 4 : t==7 ? 8 : 0);
    }
    static int elements(int dims[3]) {
        int sz = dims[0];
        if(dims[1]) sz *= dims[1];
        if(dims[2]) sz *= dims[2];
        return sz;
    }
    static Array parseArray(FSFptr &buf) {
        Array fsd = {-1};   // invalid по умолчанию
        unsigned char *b = (unsigned char *)buf.ptr;
        int ndims = b[0]&0x3;
        if(ndims==0) throw std::runtime_error("Format error: не массив");
        // в дескрипторах массивов второй байт всегда 0
        if(b[1]) throw std::runtime_error("Format error: не массив");
        int type = (b[0]>>2)&0xF;
        int sizeType = sizeOf(type);
        if(sizeType == 0) throw std::runtime_error("Format error: неизвестный тип массива");

//        int L = (b[0]>>7)&0x1;    // пока не рассматриваем длинные индексы
        int fsd_size = 8;
        unsigned char *udims = ((unsigned char *)buf.ptr)+2;
        int dims[3] = {udims[0]*256+udims[1], udims[2]*256+udims[3], udims[4]*256+udims[5]};
        int elems = elements(dims);
        int dataSize = elems * sizeType;
        // случай частичных данных во фрейме не рассматриваем - либо целиком, либо 0
        // то есть только дескриптор. Один дескриптор (без данных) используетя при передачи
        // куба DICOM
        bool valid = (fsd_size == buf.len) || (fsd_size+dataSize <= buf.len);
        if(!valid) throw std::runtime_error("Format error: фрагментация фрейма");

        fsd.nDims = ndims;
        fsd.dims[0] = dims[0]; fsd.dims[1] = dims[1]; fsd.dims[2] = dims[2];
        fsd.type = (TTTT)type;
        if(fsd_size == buf.len) {
            fsd.data = nullptr;
            buf.ptr = b+fsd_size;
            buf.len = 0;
        }
        else {
            fsd.data = b+fsd_size;
            buf.ptr = b+(fsd_size+dataSize);
            buf.len -= (fsd_size+dataSize);
        }

        return fsd;
    }
    static int cubeFormatToFSF(mvox::Cube cube) {
        mvox::PixelFormat f = cube.Format;
        switch(cube.Format) {
        case mvox::PixelFormat::Y : return Uint8<<2;
        case mvox::PixelFormat::Y2 : return Uint16<<2;
        case mvox::PixelFormat::sY2 : return Int16<<2;
        }
        return FSF_UNSUPPORTED;
    }
    static mvox::PixelFormat FSFtoCubeFormat(TTTT t) {
        mvox::PixelFormat _default = mvox::PixelFormat::Y;
        switch(t) {
        case Int8:
        case Uint8: return mvox::PixelFormat::Y;
        case Int16: return mvox::PixelFormat::sY2;
        case Uint16: return mvox::PixelFormat::Y2;
        default: return _default;
        }
        return _default;
    }

    static string header(int, bool fin = true) {return string(FSF_UNSUPPORTED,1);}
    static string header(string &s, bool _fin = true) {
        struct h_s {
            unsigned char desc; unsigned char pad; unsigned short len;
        } hs ={(unsigned char)(0x21 | fin(_fin)), 0, htons((unsigned short)s.size())};

        string h(sizeof(hs),0);
        memcpy((void *)h.c_str(),&hs,sizeof(hs));
        return h;

    }

    static string header(mvox::Cube cube, bool _fin = true) {
        struct h_s {
            unsigned char desc; // 0F000111  Uint8[] dims=3
            unsigned char pad;
            unsigned short n1,n2,n3;
        } hs ={0, 0, htons(cube.width), htons(cube.height), htons(cube.depth)};

        hs.desc = cubeFormatToFSF(cube) | fin(_fin) | 0x3;
        string h(sizeof(hs),0);
        memcpy((void *)h.c_str(),&hs,sizeof(hs));
        return h;
    }
    static string header(double a[], int n, bool _fin = true) {
        struct h_s {
            unsigned char desc; // 0F011101 0x1D  Float64[] dims=1
            unsigned char pad1;
            unsigned short n;
            unsigned char pad2[4];
        } hs ={(unsigned char)(0x1D | fin(_fin)), 0, htons(n)};

        a;  // unused
        string h(sizeof(hs),0);
        memcpy((void *)h.c_str(),&hs,sizeof(hs));
        return h;
    }

    // заголовок 1-мерного Int32Array с короткими или длинными индексами
    //
    static string header(int[], int n, bool _fin = true) {
        // это дескриптор массива Int32Array с короткими индексами
        // len[2] это длина как uint16 в MSB
        struct h_int32_short {
            unsigned char desc; // LF010001 0x11  Int32Array dims=1, F - это бит FIN, L - признак длинных индексов
            unsigned char pad;
            unsigned char len[2];
        } hs ={(unsigned char)(0x11 | fin(_fin)), 0, {0}};

        // это дескриптор массива Int32Array с короткими индексами
        // len[6] это длина как uint32 в MSB + 2 байта padding для выравнивания на границу 4 байт для Int32Array
        struct h_int32_long {
            unsigned char desc; // LF010001 0x11  Int32Array dims=1, F - это бит FIN, L - признак длинных индексов
            unsigned char pad;
            unsigned char len[6];
        } hl ={(unsigned char)(0x11 | fin(_fin) | FSF::L), 0, {0}};

        if(n < USHRT_MAX) {
            // вписываем длину в дескриптор как uint16 в MSB
            unsigned short len = htons(n);
            memcpy(hs.len,&len,2);
            string h2(sizeof(hs),0);
            memcpy((void *)h2.c_str(),&hs,sizeof(hs));
            return h2;
        }
        else {
            // вписываем длину в дескриптор как uint32 в MSB
            unsigned int len = htonl(n);
            memcpy(hl.len,&len,4);
            string h2(sizeof(hl),0);
            memcpy((void *)h2.c_str(),&hl,sizeof(hl));
            return h2;            
        }
    }

    // заголовок 1-мерного Float32Array с короткими или длинными индексами
    //
    static string header(float[], int n, bool _fin = true) {
        // это дескриптор массива Float32Array с короткими индексами
        // len[2] это длина как uint16 в MSB
        struct h_int32_short {
            unsigned char desc; // LF011001 0x19  Float32Array dims=1, F - это бит FIN, L - признак длинных индексов
            unsigned char pad;
            unsigned char len[2];
        } hs ={(unsigned char)(0x19 | fin(_fin)), 0, {0}};

        // это дескриптор массива Int32Array с короткими индексами
        // len[6] это длина как uint32 в MSB + 2 байта padding для выравнивания на границу 4 байт для Int32Array
        struct h_int32_long {
            unsigned char desc; // LF011001 0x19  Float32Array dims=1, F - это бит FIN, L - признак длинных индексов
            unsigned char pad;
            unsigned char len[6];
        } hl ={(unsigned char)(0x19 | fin(_fin) | FSF::L), 0, {0}};

        if(n < USHRT_MAX) {
            // вписываем длину в дескриптор как uint16 в MSB
            unsigned short len = htons(n);
            memcpy(hs.len,&len,2);
            string h2(sizeof(hs),0);
            memcpy((void *)h2.c_str(),&hs,sizeof(hs));
            return h2;
        }
        else {
            // вписываем длину в дескриптор как uint32 в MSB
            unsigned int len = htonl(n);
            memcpy(hl.len,&len,4);
            string h2(sizeof(hl),0);
            memcpy((void *)h2.c_str(),&hl,sizeof(hl));
            return h2;            
        }
    }

    // в маркере Uint8Array впервые задействуются длинные индексы
    // (short не хватает для blob.length)
    static string header(unsigned char a[], int n, bool _fin = true) {
        struct h_s_2 {
            unsigned char desc; // LF000101 0x5  Uint8Array[] dims=1, F - это бит FIN, L - признак длинных индексов
            unsigned char pad1;
            unsigned short n;
        } hs_2 ={(unsigned char)(0x5 | fin(_fin)), 0, htons(n)};
        struct h_s_4 {
            unsigned char desc; // 0F000101 0x5  Uint8Array[] dims=1
            unsigned char pad1;
            // записать поле длины как unsigned int нельзя:
            // граница int получится невыровненной на 4 байта и компилятор добавит
            // 2 байта перед длиной. Поэтому приходится вот так выкручиваться
            unsigned char n[4];
        } hs_4 ={(unsigned char)(0x5 | fin(_fin) | FSF::L), 0};
        a;  // unused
        if(n < USHRT_MAX) {
            string h2(sizeof(hs_2),0);
            memcpy((void *)h2.c_str(),&hs_2,sizeof(hs_2));
            return h2;
        }
        else {
            unsigned int len = htonl(n);
            unsigned char *u = (unsigned char *)&len;
            for(int i=0; i<4;i++)
                hs_4.n[i] = u[i];
            string h4(sizeof(hs_4),0);
            memcpy((void *)h4.c_str(),&hs_4,sizeof(hs_4));
            return h4;
        }
    }

    static void copyArray(Array src, void *dst, size_t len) {
        if(src.size() > len)
            throw std::runtime_error("FSF::CopyArray: недостаточно места");
        memcpy(dst,src.data,src.size());
    }
    static void send(string s, bool _fin = true) {
        string header = FSF::header(s,_fin);
        size_t size = header.size()+s.size();
        service->allocateBuf(size);
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        memcpy(buf,header.c_str(),header.size());
        memcpy(buf+header.size(),s.c_str(),s.size());
        service->sendBin(buf,size);
    }
    static void send(mvox::Cube cube, bool _fin = true) {
        // пока посылаем только Y кубы
        if(cubeFormatToFSF(cube) == FSF_UNSUPPORTED) {
            tracer.log("FSF::send(cube) формат куба не поддерживается");
            return;
        }

        string header = FSF::header(cube,_fin);
        size_t size = header.size()+cube.size();
        service->allocateBuf(size);
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        memcpy(buf,header.c_str(),header.size());
        memcpy(buf+header.size(),cube.Data,cube.size());
        service->sendBin(buf,size);
    }
    static void send(double a[], int n, bool _fin = true) {
        size_t len = n * sizeof(double);
        string header = FSF::header(a, n, _fin);
        size_t size = header.size()+len;
        service->allocateBuf(size);
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        memcpy(buf,header.c_str(),header.size());
        memcpy(buf+header.size(),a,len);
        service->sendBin(buf,size);
    }

    static void send(int a[], int n, bool _fin = true) {
        size_t byteLen = n * sizeof(int);
        string header = FSF::header(a, n, _fin);
        size_t size = header.size()+byteLen;
        service->allocateBuf(size);
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        memcpy(buf,header.c_str(),header.size());
        memcpy(buf+header.size(),a,byteLen);
        service->sendBin(buf,size);
    }

    static void send(float a[], int n, bool _fin = true) {
        size_t byteLen = n * sizeof(float);
        string header = FSF::header(a, n, _fin);
        size_t size = header.size()+byteLen;
        service->allocateBuf(size);
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        memcpy(buf,header.c_str(),header.size());
        memcpy(buf+header.size(),a,byteLen);
        service->sendBin(buf,size);
    }

    static void sendEOS() {
        unsigned char buf[] = {EOS};
        service->sendBin(buf,1);
    }

    // методы для работы с воксельными масками
    //========================================
    static void sendBitMask(mvox::Cube cube, bool _fin = true) {
        if(cube.Format != mvox::PixelFormat::Y)
            throw std::runtime_error("FSF::sendBitMask: куб должен иметь формат Y");
        // Bit mask:	00100101	0	Dim1	Dim2	Dim3	Uint8[]
        struct {
            unsigned char marker;
            unsigned char pad;
            unsigned short dims[3];
        } header = {FSF::BITMASK,0,{htons(cube.width),htons(cube.height),htons(cube.depth)}};

        size_t cubeSize = cube.size(), packedSize = cubeSize/8;
        if(cubeSize%8)  // возиться неохота с некратным размером
            throw std::runtime_error("FSF::sendBitMask: размер куба должен быть кратен 8");

        unsigned char *buf = (unsigned char *)FSF::allocateBuf(sizeof(header)+packedSize);

        buf += sizeof(header);
        unsigned char *data = (unsigned char *)cube.Data;
        for(int i=0; i<packedSize; i++) {
            buf[i] = 0;
            for(int j=0;j<8;j++)
                buf[i] |= (data[8*i+j] ? 1<<7-j : 0);
        }

        fillBuf(&header,sizeof(header));
        advanceBuf(packedSize);
        FSF::sendBuf();
    }

    static void sendMaskWithRoi(mvox::Cube cube, bool _fin = true) {
        cout << "FSF::sendMaskWithRoi"<<endl;
        if(cube.Format != mvox::PixelFormat::Y)
            throw std::runtime_error("FSF::sendMaskWithRoi: куб должен иметь формат Y");

        unsigned char *data = (unsigned char *)cube.Data;
        int ROI[6]={SHRT_MAX,0,SHRT_MAX,0,SHRT_MAX,0}; //xmin,xmax,ymin,ymax,zmin,zmax
        int ones = cube.computeROI(ROI);
        if(!ones) {
            // это для анализатора логов
            tracer.log("FFRWARN: FSF::sendMaskWithRoi() sending cube with zero ROI");
            for(int i=0; i<6; i++)
                ROI[i] = 0;
        }
        cout << "FSF::sendMaskWithRoi ROI: "<<ROI[0]<<' '<<ROI[1]<<' '<<ROI[2]<<' '<<ROI[3]<<' '<<ROI[4]<<' '<<ROI[5]<<endl;

        // Bit mask:	L0100110	0	Dim1	Dim2	Dim3	ROI[6] Uint8[]
        // в случае пустого ROI массив данных Uint8[] будет имееть нулевую длину
        // сам ROI передается как все 0, и в маркере взводится бит L
        struct {
            unsigned char marker;
            unsigned char pad;
            unsigned short dims[3];
            unsigned short ROI[6];  // ROI: xmin,xmax,ymin,ymax,zmin,zmax
        } header = {FSF::MASKWITHROI,0,{htons(cube.width),htons(cube.height),htons(cube.depth)},
                   {htons((uint16_t)ROI[0]),htons((uint16_t)ROI[1]),htons((uint16_t)ROI[2]),
                    htons((uint16_t)ROI[3]),htons((uint16_t)ROI[4]),htons((uint16_t)ROI[5])}};
        // кубик ROI включает границы, то есть [min,max] это минимальный и максимальный индексы,
        // где встретились единицы, поэтому в вычислении размера участвует +1
        size_t ROI_cube_size = (ones ? (ROI[1]-ROI[0]+1)*(ROI[3]-ROI[2]+1)*(ROI[5]-ROI[4]+1) : 0);

        unsigned char *buf = (unsigned char *)FSF::allocateBuf(sizeof(header)+ROI_cube_size);
        if(!ones)
            header.marker |= L; // признак zero-ROI

        fillBuf(&header,sizeof(header));

        if(ones) {
            buf += sizeof(header);
            // копируем данные, обратить внимание на <=
            for(int k=ROI[4]; k<=ROI[5]; k++)
                for(int j=ROI[2]; j<=ROI[3]; j++)
                    for(int i=ROI[0]; i<=ROI[1]; i++) {
                        int linInd = cube.IJK2lin(i,j,k);
                        *buf++ = data[linInd];
                    }

            advanceBuf(ROI_cube_size);
        }

        FSF::sendBuf();
    }

    static void sendBitMaskWithRoi(mvox::Cube cube, bool _fin = true) {
        if(cube.Format != mvox::PixelFormat::Y)
            throw std::runtime_error("FSF::sendBitMaskWithRoi: куб должен иметь формат Y");

        int ROI[6]; 
        int ones = cube.computeROI(ROI);
        if(!ones) {
            // это для анализатора логов
            tracer.log("FFRWARN: FSF::sendBitMaskWithRoi() sending cube with zero ROI");
            for(int i=0; i<6; i++)
                ROI[i] = 0;
        }

        // Bit mask:	L0100111	0	Dim1	Dim2	Dim3	ROI[6] Uint8[]
        // в случае пустого ROI массив данных Uint8[] будет имееть нулевую длину
        // сам ROI передается как все 0, и в маркере взводится бит L
        struct {
            unsigned char marker;
            unsigned char pad;
            unsigned short dims[3];
            unsigned short ROI[6];  // ROI: xmin,xmax,ymin,ymax,zmin,zmax
        } header = {FSF::BITMASKWITHROI,0,{htons(cube.width),htons(cube.height),htons(cube.depth)},
                   {htons((uint16_t)ROI[0]),htons((uint16_t)ROI[1]),htons((uint16_t)ROI[2]),
                    htons((uint16_t)ROI[3]),htons((uint16_t)ROI[4]),htons((uint16_t)ROI[5])}};

        size_t ROI_cube_size = (ones ? (ROI[1]-ROI[0]+1)*(ROI[3]-ROI[2]+1)*(ROI[5]-ROI[4]+1) : 0);
        size_t packedSize = ROI_cube_size/8 +(ROI_cube_size%8 ? 1 : 0);
        unsigned char *buf = (unsigned char *)FSF::allocateBuf(sizeof(header)+packedSize);

        if(!ones)
            header.marker |= L; // признак zero-ROI

        fillBuf(&header,sizeof(header));
        if(ones) {
            buf += sizeof(header);
            unsigned char d8[8]; int d8Cnt = 0, bufCnt = 0;
            // пакуем данные, обратить внимание на <=
            unsigned char *data = (unsigned char *)cube.Data;
            for(int k=ROI[4]; k<=ROI[5]; k++)
                for(int j=ROI[2]; j<=ROI[3]; j++)
                    for(int i=ROI[0]; i<=ROI[1]; i++) {
                        int linInd = cube.IJK2lin(i,j,k);
                        if(d8Cnt < 8)
                            d8[d8Cnt++] = data[linInd];
                        if(d8Cnt == 8) {
                            buf[bufCnt] = 0;
                            for(int l=0;l<8;l++)
                                buf[bufCnt] |= (d8[l] ? 1<<7-l : 0);
                            bufCnt++;
                            d8Cnt = 0;
                        }
                    }

            // досбросим данные, если надо
            if(d8Cnt) {
                buf[bufCnt] = 0;
                for(int l=0;l<d8Cnt;l++)
                    buf[bufCnt] |= (d8[l] ? 1<<7-l : 0);
            }
        }
        advanceBuf(packedSize);
        FSF::sendBuf();
    }


    static size_t evalSize(string &s) {return round8(header(s).size() + s.size());}
    static size_t evalSize(mvox::Cube cube) { return header(cube).size()+cube.size(); }
    static size_t evalSize(double a[], int n) { return header(a,n).size()+n*sizeof(double)+8; }
    static size_t evalSize(unsigned char a[], int n) {return header(a,n).size()+n*sizeof(unsigned char);}

    static void *allocateBuf(size_t len) {return service->allocateBuf(len);}
    static void advanceBuf(size_t len) {service->txbufBin.offset += len;}

    static void fillBuf(const void *p, size_t len) {
        unsigned char *buf = service->txbufBin.data + service->txbufBin.offset;
        memcpy(buf,p,len);
        service->txbufBin.offset += len;
    }
    static void fillBuf(string s, bool _fin = false) {
        string h = header(s,_fin);
        fillBuf(h.c_str(),h.size());
        fillBuf(s.c_str(),s.size());
        roundBuf();
    }

    static void fillBuf(mvox::Cube cube, bool _fin = false) {
        string h = header(cube,_fin);
        fillBuf(h.c_str(),h.size());
        fillBuf(cube.Data,cube.size());
    }

    static void fillBuf(double a[], int n, bool _fin = false) {
        roundBuf();
        string h = header(a,n,_fin);
        fillBuf(h.c_str(),h.size());
        fillBuf((void *)a,n*sizeof(double));
    }
    static void fillBufAsUint8Array(unsigned char a[], int n, bool _fin = false) {
        string h = header(a,n,_fin);
        fillBuf(h.c_str(),h.size());
        fillBuf((void *)a,n*sizeof(unsigned char));
        roundBuf();
    }

    // посылает все, что накоплено в буфере
    static void sendBuf() {
        size_t len = service->txbufBin.offset - LWS_SEND_BUFFER_PRE_PADDING;
        if(len > 0) {
            unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
            service->sendBin(buf,len);
        }
    }

    static void writeBufToFile(string filename) {
        FILE *fd = fopen(filename.c_str(),"wb");
        if(!fd) {tracer.log(string("FSF::writeBufToFile() can't open ")+filename); return;}
        size_t len = service->txbufBin.offset - LWS_SEND_BUFFER_PRE_PADDING;
        tracer.log(string("FSF::writeBufToFile() saving ")+std::to_string(len)+string(" bytes to ")+filename+" ..");
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        fwrite(buf,len,1,fd);
        tracer.log("ok");
        fclose(fd);
    }

    static void appendBufToFile(string filename) {
        FILE *fd = fopen(filename.c_str(),"ab");
        if(!fd) {tracer.log(string("FSF::writeBufToFile() can't open ")+filename); return;}

        size_t len = service->txbufBin.offset - LWS_SEND_BUFFER_PRE_PADDING;
        tracer.log(string("FSF::appendBufToFile() appending ")+std::to_string(len)+string(" bytes to ")+filename+" ..");
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        fwrite(buf,len,1,fd);
        tracer.log("ok");
        fclose(fd);

    }
    // вариант sendFile где в конце посылается EOS
    static void sendFile(string filename) {
        FILE *fd = fopen(filename.c_str(),"rb");
        if(!fd) {tracer.log(string("FSF::sendFile() can't open ")+filename); return;}
        fseek(fd,0,SEEK_END);  size_t len = ftell(fd); fseek(fd,0,SEEK_SET);
        service->allocateBuf(len+1);        // в конце буфера EOS
        tracer.log(string("FSF::sendFile() reading ")+std::to_string(len)+string(" bytes from ")+filename+" ..");
        unsigned char *buf = service->txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
        fread(buf,len,1,fd);
        buf[len] = EOS;
        fclose(fd);
        service->txbufBin.offset = LWS_SEND_BUFFER_PRE_PADDING + len+1;
        sendBuf();
    }

    /*
     *          Это BINARY FSF
     */
    static int decodeCmd(void *buf, size_t len) {
        if(len < 2) return 0;
        unsigned char * data = (unsigned char *)buf;
        return (data[0] == 0x38 ? data[1] : 0);
    }
};



FFRService::FFRService() :wsi(nullptr) {}
FFRService::FFRService(lws *wsi) :wsi(wsi) { service = this; }
const char *FFRService::version() { return "[1.2.4.72]-2022-10-20"; }

// ffr-protocol:
// "version"                            -> "v1"
// "AortaSearch_FindAorta" (binary)     -> [OK, img, circles[]] | ERR       ## since 1.2.4.70
// "Initialize {FFRSettings}" (binary)  -> "ok"                             ## since 1.2.4.70
// "PrepareAortaProc"                   -> progress %f text... "fin"
// "GetOptimalTau"                      -> double                           ## added in 1.2.4.66
// "LoadAortaPreview" targetCode tau    -> uint8[]
// "PrepareVesselsProc" VesselsSegmParameters              -> progress %f text... "fin"
// "SetVesselsSeeds" [params ?]         -> "ok"
// "LoadVesselsPreview" <threshold>     -> uint8[]
// "Thinning" {CompleteParameters}      -> progress %f text... "fin retcode" ## retcode - cursor number
// "DeleteVessel" vesselIndex           -> "ok" | "error"                   ## added in 1.2.4.69
// "LoadAortaObject"                    -> uint8[]
// "GetVesselsObjectsCount"             -> int
// "LoadVesselsObject" index            -> uint8[]
// "GetVesselsCount"                    -> int
// "GetVesselInfo" index                -> centerLineCount bifurcationsCount  name
// "GetVesselBifurcations" index        -> mvox::Point3D_Double[]
// "GetVesselCenterLine" index          -> mvox::Point3D_Double[]
// "PrepareResult [{Front Rear percent}]" -> progress %f text... "fin [FFR-value | error num]"  ## до 1.2.4.72
// "test *"                             ## различные тестовые сообщения
// "test load state4"
// "test load svetz-190"
// "test lws"
//
// Двоичный протокол:
//
// cmd 3: parseLoadCubeCommand
// cmd 4: AortaSearch_FindAorta
// cmd 5: Initialize
// cmd 6: PrepareResult([{Front Rear percent}], [Psys,Pdia,SV,HR])              ## since 1.2.4.72


void FFRService::frameRecieved(void *in, size_t len)
{
    //tracer.logInt("FFRService::frameRecieved is_binary",lws_frame_is_binary(wsi));

    unsigned char *data = (unsigned char *)&txbufText.data[LWS_SEND_BUFFER_PRE_PADDING];
    memcpy( data, in, len );
    txbufText.len = len;
    data[len]=0;   // без контроля, полагаясь на то, что lws соблюдает максимальную длину буфера
    string msg((char*)data);    // пока считаем, что все сообщения текстовые
    tracer.log(string("ffr-protocol (rcv):")+msg);
    setbuf(stdout,0);

    if(msg=="version") {
        sendText(version());
    }
    else if(msg=="PrepareAortaProc") {
        // FFR_Process_PrepareAortaProc(FFR,cube,my_update_progres);

        // Вызов этого метода подразумевает, что куб передан и FFRProcessor уже создан

//        printCube(this->sourceCube);
        enableUpdateProgress(true);
        FFR_Process_PrepareAortaProc(this->FFR,this->sourceCube,FFRService_update_progres);

        // по возврату из FFR_Process_PrepareAortaProc надо послать fin сообщение для progress bar
        sendText("fin");
        enableUpdateProgress(false);
    }
    else if(msg=="GetOptimalTau") {
        double optimal_tau = FFR_GetOptimalTau(this->FFR);
        sendText(to_string(optimal_tau));
    }

    // LoadAortaPreview targetCode tau
    else if(msg.find("LoadAortaPreview") ==0) {
        double tau=0.09; sscanf(msg.c_str(),"LoadAortaPreview %lf",&tau);
        mvox::Cube segmCube = allocateSegmCube();

        FFR_Process_LoadAortaPreview(this->FFR, segmCube, 1, tau);

        // это отсылка данных просто как binary data, на принимающем конце будет получен ArrayBuffer
        // который будет проинтерпретирован как Uint8Array с известной размерностью куба
        //
        //int size = segmCube.width * segmCube.height * segmCube.depth;
        //sendBin(segmCube.Data,size);

        // альтернативный способ - посылать воксельную маску (FSF тип 9) битовую и/или с ROI
        //
        //FSF::sendBitMask(segmCube);
        //FSF::sendMaskWithRoi(segmCube);
        FSF::sendBitMaskWithRoi(segmCube);

        delete[] (char *)segmCube.Data;
    }

    else if(msg.find("PrepareVesselsProc")==0) {
        extern bool trace_callback_ffr; trace_callback_ffr = true; tracer.log("trace_callback_ffr turned on");
        float tau,alpfa,beta,gamma;
        sscanf(msg.c_str(),"PrepareVesselsProc %f %f %f %f",&tau,&alpfa,&beta,&gamma);
        VesselsSegmParameters params = {tau,alpfa,beta,gamma};
        enableUpdateProgress(true);
        FFR_Process_PrepareVesselsProc(this->FFR, this->sourceCube, FFRService_update_progres,params);
        sendText("fin");
        enableUpdateProgress(false);
    }
    else if(msg=="SetVesselsSeeds") {
        FFR_Process_SetVesselsSeeds(this->FFR, nullptr,0);
        sendText("ok");
    }
    else if(msg.find("LoadVesselsPreview")==0) {    // LoadVesselsPreview <threshold>
        float threshold; sscanf(msg.c_str(),"LoadVesselsPreview %f",&threshold);
        mvox::Cube segmCube = allocateSegmCube();

        uint8_t targetcode = 1;
        FFR_Process_LoadVesselsPreview(this->FFR, segmCube, targetcode, threshold);
        this->lastLoadVesselsPreviewThreshold = threshold;   // может понадобится в Thinning

        //int size = segmCube.width * segmCube.height * segmCube.depth;
        //sendBin(segmCube.Data,size);    // это старый способ передачи
        FSF::sendBitMaskWithRoi(segmCube);

        delete[] (char *)segmCube.Data;
    }

    else if(msg.find("Thinning")==0) {  // Thinning {CompleteParameters}
        float tau,alpfa,beta,gamma,threshold;
        sscanf(msg.c_str(),"Thinning %f %f %f %f %f",&tau,&alpfa,&beta,&gamma,&threshold);
        CompleteParameters params = {{tau,alpfa,beta,gamma},threshold};
        enableUpdateProgress(true);

        // принудительное выполнение LoadVesselsPreview если переданный threshold 
        // не совпадает с последним в LoadVesselsPreview
        if(this->lastLoadVesselsPreviewThreshold != threshold) {
            mvox::Cube segmCube = allocateSegmCube();
            FFR_Process_LoadVesselsPreview(this->FFR, segmCube, 1, threshold);
            delete[] (char *)segmCube.Data;
        }

        int retcode = FFR_Process(this->FFR,this->sourceCube,FFRService_update_progres,params);
        string ret = string("fin ")+to_string(retcode);
        sendText(ret);
        enableUpdateProgress(false);
    }

    else if(msg.find("DeleteVessel")==0) {  // DeleteVessel ind
        int ind = -1;
        sscanf(msg.c_str(),"DeleteVessel %d",&ind);
        if(ind < 0 || ind >=FFR_GetVesselsCount(this->FFR))
            sendText("error: invalid vessel index");
        else {
            // FFR_DeleteVessel возвращает курсор, но смысл его непонятен
            FFR_DeleteVessel(this->FFR, ind);
            sendText("ok");
        }
    }

    else if(msg=="LoadAortaObject") {
        this->aortaObject = allocateSegmCube();
        FFR_LoadAortaObject(this->FFR,this->aortaObject,1);
        FSF::sendBitMaskWithRoi(this->aortaObject);

//        int size = this->aortaObject.size();
//        sendBin(this->aortaObject.Data,size);
//        write_cube(this->aortaObject,aortaCubeDatFile);
//        delete[] (char *)segmCube.Data;
    }

    else if(msg=="GetVesselsObjectsCount") {
        this->vesselsObjectsCount = FFR_GetVesselsObjectsCount(this->FFR);
        sendText(to_string(vesselsObjectsCount));
    }

    else if(msg.find("LoadVesselsObject") != -1) {  // LoadVesselsObject index
        int vesselObjectInd = -1, targetCode = 1;
        int vesselsObjectsCount = FFR_GetVesselsObjectsCount(this->FFR);

        // std::string.split() не существует, придется сделать по рабоче-крестьянскому
        sscanf(msg.c_str(),"LoadVesselsObject %d",&vesselObjectInd);
        if(vesselObjectInd < 0 ||  vesselObjectInd >= vesselsObjectsCount) {
            sendText("error msg");
            return;
        }

        mvox::Cube segmCube = allocateSegmCube();

        FFR_LoadVesselsObject(this->FFR,segmCube,targetCode,vesselObjectInd);
        FSF::sendBitMaskWithRoi( segmCube);

//        int size = segmCube.size();
//        sendBin(segmCube.Data,size);
//        write_cube(segmCube,vesselCubeDatFile[vesselObjectInd]);
//        delete[] (char *)segmCube.Data;

        // сохраним vessel cube для state4
        int maxVesselObjectIndForSave = sizeof(this->vesselObject) /sizeof(this->vesselObject[0]);
        if(vesselObjectInd < maxVesselObjectIndForSave)
            this->vesselObject[vesselObjectInd] = segmCube;
    }

    else if(msg=="GetVesselsCount") {
        this->vesselsCount = FFR_GetVesselsCount(this->FFR);
        sendText(to_string(vesselsCount));

    }

    else if(msg.find("GetVesselInfo") != -1) {  // GetVesselInfo index
        int centerLineCount, bifurcationsCount; wchar_t wname[64] = L"my vessel"; int vesselIndex = -1;
        int vesselsCount = FFR_GetVesselsCount(this->FFR);
        int maxVesselesForSave = sizeof(this->vesselInfo) / sizeof(this->vesselInfo[0]);

        sscanf(msg.c_str(),"GetVesselInfo %d",&vesselIndex);
        if(vesselIndex < 0 ||  vesselIndex >= vesselsCount) {
            sendText("error msg");
            return;
        }

        FFR_GetVesselInfo(this->FFR,vesselIndex,&centerLineCount,&bifurcationsCount,wname);
        std::wstring ws(wname); string name(ws.begin(), ws.end());
        stringstream ss; ss << centerLineCount << ' ' << bifurcationsCount << ' ' << name;

        // Сохранить centerLineCount bifurcationsCount и имя в информации о сосуде
        if(vesselIndex < maxVesselesForSave) {
            this->vesselInfo[vesselIndex].name = name;
            this->vesselInfo[vesselIndex].bifurcationsCount = bifurcationsCount;
            this->vesselInfo[vesselIndex].centerLineCount = centerLineCount;
        }
        else
            // это не должно произойти, так на всякий случай
            tracer.log("не могу сохранить информацию о сосуде");

        sendText(ss.str());
    }

    else if(msg.find("GetVesselBifurcations") != -1) { // GetVesselBifurcations index
        int centerLineCount, bifurcationsCount; wchar_t name[64]; int vesselIndex = -1;
        int vesselsCount = FFR_GetVesselsCount(this->FFR);
        int maxVesselesForSave = sizeof(this->vesselInfo) / sizeof(this->vesselInfo[0]);

        sscanf(msg.c_str(),"GetVesselBifurcations %d",&vesselIndex);
        if(vesselIndex < 0 ||  vesselIndex >= vesselsCount) {
            sendText("error msg");
            return;
        }

        FFR_GetVesselInfo(this->FFR,vesselIndex,&centerLineCount,&bifurcationsCount,name);
        mvox::Point3D_Double *points = new mvox::Point3D_Double[bifurcationsCount];
        FFR_GetVesselBifurcations(this->FFR,vesselIndex,points,bifurcationsCount);
        //FFR_GetVesselCenterLine(FFR,vesselIndex,points,centerLineCount);
        if(vesselIndex == 0) {
            stringstream ss;
            for(int i=0; i<bifurcationsCount; i++) {
                ss << "(" << points[i].x << ',' << points[i].y << ',' << points[i].z << ") ";
                if(i>1) break;
            }
            tracer.log(ss.str());
        }

        // Сохранить bifurcation Points в информации о сосуде
        if(vesselIndex < maxVesselesForSave) {
            this->vesselInfo[vesselIndex].bifurcationPoints = points;
        }
        else
            // это не должно произойти, так на всякий случай
            tracer.log("не могу сохранить информацию о сосуде");

        sendBin(points,bifurcationsCount*sizeof(mvox::Point3D_Double));
    }

    else if(msg.find("GetVesselCenterLine") != -1) { // GetVesselBifurcations index
        int centerLineCount, bifurcationsCount; wchar_t name[64]; int vesselIndex = -1;
        int vesselsCount = FFR_GetVesselsCount(this->FFR);
        int maxVesselesForSave = sizeof(this->vesselInfo) / sizeof(this->vesselInfo[0]);

        sscanf(msg.c_str(),"GetVesselCenterLine %d",&vesselIndex);
        if(vesselIndex < 0 ||  vesselIndex >= vesselsCount) {
            sendText("error msg");
            return;
        }

        FFR_GetVesselInfo(this->FFR,vesselIndex,&centerLineCount,&bifurcationsCount,name);
        mvox::Point3D_Double *points = new mvox::Point3D_Double[centerLineCount];
        FFR_GetVesselCenterLine(this->FFR,vesselIndex,points,centerLineCount);
        if(vesselIndex == -1) {
            stringstream ss;
            for(int i=0; i<centerLineCount; i++) {
                ss << "(" << points[i].x << ',' << points[i].y << ',' << points[i].z << ") ";
                if(i>1) break;
            }
            tracer.log(ss.str());
        }

        // Сохранить centerLine Points в информации о сосуде
        if(vesselIndex < maxVesselesForSave) {
            this->vesselInfo[vesselIndex].centerLinePoints = points;
        }
        else
            // это не должно произойти, так на всякий случай
            tracer.log("не могу сохранить информацию о сосуде");

        sendBin(points,centerLineCount*sizeof(mvox::Point3D_Double));
    }

    else if(msg.find("PrepareResult") != -1) {
        tracer.log(msg);
        vector<string> parts;
        stringstream ss(msg.substr(13)); string line;
        while (std::getline(ss, line, '\n'))
            parts.push_back(line);
        // PrepareResult x1 y1 z1 x2 y2 z2 UserPercent

        // здесь передаются данные, необходимые для FFR_PrepareResult, то есть массив FFRStenosis[]
        // (пока работаем только с одним стенозом)
        // FFRStenosis {Id, StenosisType, Center, Front, Rear}, StenosisType всегда будет Stenosis = 0,
        // Center, Front, Rear: struct CrossInfo { mvox::Point3D_Double Position; double Area; }
        // Center реально не используется, Area во всех структурах тоже
        // Поэтому параметрами сообщения PrepareResult будут только позиции Front и Rear
        // то есть 2 триплета double.
        FFRStenosis stenosis[10]; // 10 - хардкод
        for(int i=0; i<parts.size(); i++) {
            float x1,y1,z1,x2,y2,z2; int  UserStenosisPercent;
            sscanf(parts[i].c_str()," %f %f %f %f %f %f %d",&x1,&y1,&z1,&x2,&y2,&z2, &UserStenosisPercent);
            stringstream ss; ss <<"stenosis#"<<i<<": " << x1 <<' ' << y1 <<' ' << z1 <<' ' << x2 <<' ' << y2 <<' ' <<z2 <<' ' <<UserStenosisPercent<<"%";
            tracer.log(ss.str());
            // {1, Stenosis, {{66,-32,-841},5}, {{65.367, -31.302, -841},5}, {{69.012, -33.327, -841},5}};
            stenosis[i] = {1, Stenosis,  {{0, 0, 0},5}, {{x1, y1, z1},5}, {{x2, y2, z2},5}, UserStenosisPercent };
        }

        FFR_PrepareResult(this->FFR, stenosis,parts.size(), mywriter);

        // имитация запуска процесса blood
        lws_context *context = lws_get_context(this->wsi);
        FFRServiceUserData * userData = (FFRServiceUserData *)lws_context_user(context);
        if(!this->spawnBloodProcess(userData))
            sendText("error: cant start blood.exe process");
    }

    else if(processTestMessage(msg))
        return;

    else {
        sendText(string("error unrecognized message:")+msg);
    }
}

//Получен двоичный фрейм - это входная точка реализации двоичного FSF протокола
// lws_is_final_fragment lws_is_first_fragment
void FFRService::frameRecievedBinary(lws *wsi, void *user, void *data, size_t len)
{
    string logId = "FFRService::frameRecievedBinary():";
    stringstream ss; ss << logId;
    ss<<" first="<<lws_is_first_fragment(wsi) << " last="<<lws_is_final_fragment(wsi) << " len "<<len;
    ss<<" data: "<< hex(data,len,8);

    // отсутствие контекста фрейма означает, что протокол находится в режиме ожидания команды
    // иначе это означает наличие входного потока. Входной поток, и вообще взаимодействие типа
    // stream-stream, пока есть только в команде LOAD CUBE
    if(!frameCtx) {
        int cmd = FSF::decodeCmd(data,len);
        tracer.logInt("ffr-protocol (rcv) BINARY CMD",cmd);
        switch(cmd) {
            case 3: this->parseLoadCubeCommand(((char*)data)+2,len-2);      break;
            case 4: this->AortaSearch_FindAorta(((char*)data)+2,len-2);     break;
            case 5: this->Initialize(((char*)data)+2,len-2);                break;
            case 6: this->PrepareResult(((char*)data)+2,len-2);                break;
            default:
                    ss << logId << " неизвестная команда " << cmd << " (ошибка протокола)";
                    tracer.log(ss.str()); ss.str("");
                    ss << " неизвестная команда " << cmd;
                    sendError(255,ss.str());
        }
        return;
    }

    // есть контекст команды фрейма - копируем данные
    static int cntFrames = 0;
   // cout << "пришло "<< len <<" байт для контекста фрейма. копирую.."<<endl;
   // cout<<".";
    cntFrames++;
    if(frameCtx->bytesRemained < len) {
        ss << logId << " фрейм данных больше ожидаемого";
        tracer.log(ss.str());
        return;
    }
    memcpy(frameCtx->bufPtr,data,len);
    frameCtx->bytesRemained -= len;
    frameCtx->bufPtr = ((char *)frameCtx->bufPtr)+len;
    // this->frameCtx->bytesExpected = this->frameCtx->bytesRemained = len;
    float uploadPercent = 1.0*(this->frameCtx->bytesExpected - this->frameCtx->bytesRemained) / this->frameCtx->bytesExpected;
    enableUpdateProgress(true);
    if(fabs(uploadPercent-frameCtx->lastShownPercent) > 0.01) {
        FFRService_update_progres(uploadPercent, L"transfering DICOM data");
        frameCtx->lastShownPercent = uploadPercent;
    }


    if(frameCtx->bytesRemained == 0) {
        if(!lws_is_final_fragment(wsi)) {
           tracer.log(logId+" все данные получены, но фрейм не помечен как final");
        }

        cout << "cntFrames="<<cntFrames << endl;

        sendText("fin");
        enableUpdateProgress(false);
        endOfFrameContext();
    }
    else {
//        ss << logId << "получено " << len << " байт. Осталось получить " << frameCtx->bytesRemained;
//        tracer.log(ss.str());
    }
}

void FFRService::sendText(const string &msg)
{
    unsigned char *data = (unsigned char *)&txbufText.data[LWS_SEND_BUFFER_PRE_PADDING];
    int len = msg.size();

    if(len > EXAMPLE_RX_BUFFER_BYTES) {
        stringstream ss; ss << "send(): message length  "<<len<<" exceeds maxlen "<<EXAMPLE_RX_BUFFER_BYTES<<"..truncating";
        tracer.log(ss.str());
        len = EXAMPLE_RX_BUFFER_BYTES;
    }
    memcpy(data,msg.c_str(),len);
    lws_write( wsi, data, len, LWS_WRITE_TEXT );
    tracer.log(string("ffr-protocol (snd):")+msg);
}

void FFRService::processUserData(lws_context *context)
{
    FFRServiceUserData * userData = (FFRServiceUserData *)lws_context_user(context);
    if(userData->pid == -1) return;
#ifdef __unix__
    int tElapsed = Tracer::msec().sec - userData->sec;
    int ret = waitpid(userData->pid, &userData->status, WNOHANG);
    if(ret == -1) {
        tracer.log("waitpid returned -1");
        userData->pid = -1;
    }
    else if(ret == userData->pid) {
        userData->pid = -1;
        tracer.logInt("waitpid returned status", userData->status);
        tracer.logInt("WIFEXITED=",WIFEXITED(userData->status));
        int exitStatus = WEXITSTATUS(userData->status);
        tracer.logInt("WEXITSTATUS=",exitStatus);
        if(exitStatus == 0) {
            // начиная с версии 1.2.4.72 формат файла FFR.tre такой
            // для каждого стеноза в нем записано 4 строки - номер сосуда, ФРК, и еще две величины
            ifstream result("./FFR/FFR.tre");
            string res;
            result >> res; result >> res;
            tracer.log(string("FFR.tre contains:")+res);
            stringstream in(res); float fres; in >> fres;
            char buf[64]; snprintf(buf,sizeof(buf),"fin %f",fres);
            sendText(buf);
        }
        else {
            char buf[64]; snprintf(buf,sizeof(buf),"fin error %d",exitStatus);
            sendText(buf);
        }
        
    }
    else {  // процесс еще не закончился
        if(tElapsed % userData->tick == 0)  {
            int percent = tElapsed / userData->tick;
            if (percent >= 100) percent = 99;
            char buf[20];
            snprintf(buf,sizeof(buf),"%.2f",percent/100.);
            stringstream ss; ss << buf <<' '<<"расчет фракционного резерва кровотока стеноза #1";
            sendText(ss.str());
        }
    }
#endif
}

void FFRService::updateProgress(float relativeProgress, const wchar_t *status)
{
    std::wstring ws(status);
    string str(ws.begin(), ws.end());
    stringstream ss; ss << roundf(relativeProgress*1000)/1000. << ' ' << str;

    if(this->updateProgressEnabled)
        sendText(ss.str());
    else
        tracer.log(ss.str());
}

void FFRService::sendBin(void *data, size_t len)
{
    // обеспечивает буфер нужной длины
    allocateBuf(len);
    unsigned char *buf = txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
    // контролировать длину?
    memcpy(buf,data,len);
    sendBuf(len);
}

void FFRService::sendOK()
{
    unsigned char msg[] = {FSF::OK,0};
    sendBin((void  *)msg,2);
}

void FFRService::sendError(int code, string reason)
{
    unsigned char msg[] = {FSF::ERR,(unsigned char)code};
    cout<<"FSF::evalSize(reason)="<<FSF::evalSize(reason);
    FSF::allocateBuf(sizeof(msg)+FSF::evalSize(reason));
    FSF::fillBuf(msg,sizeof(msg));
    FSF::fillBuf(reason);
    FSF::sendBuf();
}

// переслать len байт из буфера в формате BINARY
//
void FFRService::sendBuf(size_t len)
{
    unsigned char *buf = txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
    lws_write( wsi, buf, len, LWS_WRITE_BINARY );
    stringstream ss; ss << "ffr-protocol (send BINARY): " << len << " bytes: "<<hex(buf,len,16);
    tracer.log(string(ss.str()));
}


void *FFRService::allocateBuf(size_t len)
{
    if(txbufBin.len < len ) {
        releaseBuf();
        size_t actual_len = LWS_SEND_BUFFER_PRE_PADDING + len + LWS_SEND_BUFFER_POST_PADDING;
        txbufBin.data = (unsigned char *) new char[actual_len];
        txbufBin.len = len;
    }
    txbufBin.offset = LWS_SEND_BUFFER_PRE_PADDING;

    return txbufBin.data + txbufBin.offset;
}

void FFRService::releaseBuf()
{
    if(txbufBin.data) {
        delete[] txbufBin.data;
        txbufBin = {nullptr,0,0};
    }
}

mvox::Cube FFRService::allocateSegmCube()
{
//    tracer.startInterval("FFRService::allocateSegmCube()");
    mvox::Cube segmCube; segmCube.Format = mvox::PixelFormat::Y;
    segmCube.width = sourceCube.width; segmCube.height = sourceCube.height; segmCube.depth = sourceCube.depth;
    int size = segmCube.size();
    segmCube.Data = new char[size];   
    memset(segmCube.Data,0,size);
//    tracer.logInterval("FFRService::allocateSegmCube()");
    return segmCube;
}

#include <math.h>
bool FFRService::processTestMessage(const string &msg)
{
    // в ответ на это сообщение идет серия "%f waiting".."%f waiting" "fin" для имитации progressbar в UI
    //
    if(msg=="test progress") {
        for(int i=0; i<3; i++) {
            stringstream ss; ss << (0.2*i) << " waiting";
            sendText(ss.str());
            tracer.log(ss.str());
            std::this_thread::sleep_for(3s);
        }
        sendText("fin");
        return true;
    }
    // test LoadAortaPreview targetCode tau
    else if(msg.find("test LoadAortaPreview") ==0) {
        tracer.log("test LoadAortaPreview");
        mvox::Cube cube;
        cube.width = 512; cube.height = 512; cube.depth = 113;
        cube.Format = mvox::PixelFormat::Y;
        size_t len = cube.width * cube.height * cube.depth;
        string datfile = "/mnt/d/Users/german/Desktop/V5/Тимур/MultiVox/Bin/ffr-aorta-mask-pochukaeva-113.dat";

        bool ok = read_cube(cube,datfile);
        if(ok) {
            void repackCubeAsBoolean(mvox::Cube cube, uint8_t targetCode);
            repackCubeAsBoolean(cube,10);
            sendBin(cube.Data,len);
        }
        else
            sendText("error");
        return true;
    }

    // это эксперимент по отправке клиенту большого массива двоичных данных одним куском
    //
    else if(msg=="test downstream") {
        const int NUM_SHORTS=100*1024*1024;
        const int DATA_SIZE=NUM_SHORTS*sizeof(short);
        stringstream ss; ss << "sending back binary data "<<NUM_SHORTS<<" shorts";
        tracer.log(ss.str());
        char *data = new char[DATA_SIZE];
        sendBin(data,DATA_SIZE);
        delete[] data;
        return true;
    }

    // тесты двоичного протокола
    else if(msg.find("test binary") != -1) {
        double pi = M_PI, e = M_E, arr[]={M_PI,M_E,-1};
        tracer.log("Тесты двоичного протокола");
        //sendText("hello from test binary");
        sendBin(arr,sizeof(arr));
        //sendDoubleArray(arr,3);
        return true;
    }

    // мне надо послать 3 куба в формате Y 6 x (VesselBifurcations Points VesselCenterline Points)
    // аорта, vessel0[], vessel1[], 6x {name, Bifurcations[], Centerline[]}

    else if(msg=="test stream string") {
        FSF::send("Привет",false);
        return true;
    }

    else if(msg=="test stream cube") {
        // преобразуем ffr-cube-pochukaeva-113.bin (FORMAT sY2) в формат FSF
        std::string ffr_cube_113 = "/mnt/d/xampp/htdocs/V5-FFR/ffr-cube-pochukaeva-113.bin";
        mvox::Cube cube = {nullptr, mvox::PixelFormat::sY2, 512, 512, 113, 0.405, 0.405, 1.0};
        cube.ImageToSpace = {0.405, 0, 0, 0, 0, 0.405, 0, 0, 0, 0, 1, 0, -53.7033, -134.172, -927, 1};
        cube.SpaceToImage = {2.46914, -0, 0, -0, -0, 2.46914, -0, 0, 0, -0, 1, -0, 132.601, 331.289, 927, 1};
        read_cube(cube, ffr_cube_113);
        assert(cube.Data);      // я похоже в release mode на Ubuntu
        FSF::send(cube, true);

//        mvox::Cube cube; cube.width = cube.height = cube.depth = 1; cube.Format = mvox::PixelFormat::sY2;
//        short data[] = {1,-1, 3};
//        cube.Data = data;
//        FSF::send(cube, true);

        return true;
    }

    else if(msg=="test stream string+cube") {
        FSF::send("Привет",false);
        mvox::Cube cube; cube.width = cube.height = cube.depth = 1;
        unsigned char data[] = {1}; cube.Data = data;
        FSF::send(cube, true);
        return true;
    }
    else if(msg=="test Int32Array short") {
        int data[] = {1,2,3,4,5}, n = sizeof(data) / sizeof(int);
        FSF::send(data,n);
        return true;
    }
    else if(msg=="test Int32Array long") {
        const int len =  100000;
        int *data = new int[len];
        for(int i=0; i<len; i++)
            data[i] = i;
        FSF::send(data,len);
        delete[] data;
        return true;
    }
    else if(msg=="test Float32Array short") {
        float data[] = {1.,2.,3.14,4,5}, n = sizeof(data) / sizeof(float);
        FSF::send(data,n);
        return true;
    }
    else if(msg=="test Float32Array long") {
        const int len =  100000;
        float *data = new float[len];
        for(int i=0; i<len; i++)
            data[i] = i*1.01;
        FSF::send(data,len);
        delete[] data;
        return true;
    }

    /*
     * Загрузка состояния перед маркировкой стеноза
     */

    else if(msg=="test load state4") {

        //saveState4();
        FSF::sendFile(this->state4);
        return true;
    }
    else if(msg=="test load svetz-190") {
        // это в качестве поверхности посылается маска аорты после сегментации
        // mvox::Cube cube; cube.Data = nullptr;
        // cube.width = cube.height = 512; cube.depth = 190;
        // cube.Format = mvox::PixelFormat::Y;
        // if(!read_cube(cube, "shvetz-190-mask.bin")) {
        //     sendText("error: can't read shvetz-190-mask.bin");
        //     return true;
        // }
        // FSF::sendBitMaskWithRoi(cube);

        // а это "тонкая поверхность", которая возникает при расчете кривизн
        // куб при этом наддут на +10 пр всем трем направлениям
        mvox::Cube cube; cube.Data = nullptr;
        cube.width = cube.height = 512+20; cube.depth = 190+20;
        cube.Format = mvox::PixelFormat::Y;
        if(!read_cube(cube, "svetz-thin-mask.bin")) {
            sendText("error: can't read svetz-thin-mask.bin");
            return true;
        }
        FSF::sendBitMaskWithRoi(cube);

        return true;
    }
    else if(msg=="test lws") {
        mvox::Cube cube;
        cube.width = cube.height = cube.depth = 4;
        cube.Format = mvox::PixelFormat::Y;
        size_t size = cube.size();
        cube.Data = new char[size];
        memset(cube.Data,0,size);

        tracer.log("sending cube 4x4x4 with ROI all zeros (so there is no ROI)");
        FSF::sendBitMaskWithRoi(cube);
        delete[] (char *)cube.Data;
        tracer.log("sending cube 4x4x4 with no ROI (all zeros) done");

        return true;

    }
    // приходится аорту Швец и гауссовы фреймы с кривизнами передавать по отдельности
    else if(msg=="test load svetz-frame-i") {
        FILE *fd = fopen("shvetz-frame-i.bin","rb");
        if(!fd) {FSF::send("err"); return true;}
        fseek(fd,0,SEEK_END);
        long size = ftell(fd);
        fseek(fd,0,SEEK_SET);
        int dim = size/sizeof(int);
        int *data = new int[dim];
        fread(data,size,1,fd);
        fclose(fd);
        FSF::send(data,dim);
        delete[] data;        
        return true;
    }
    else if(msg=="test load svetz-frame-k") {
        FILE *fd = fopen("shvetz-frame-k.bin","rb");
        if(!fd) {FSF::send("err"); return true;}
        fseek(fd,0,SEEK_END);
        long size = ftell(fd);
        fseek(fd,0,SEEK_SET);
        int dim = size/sizeof(int);
        float *data = new float[dim];
        fread(data,size,1,fd);
        fclose(fd);
        FSF::send(data,dim);
        delete[] data;        
        return true;
    }

    return false;
}
#if 0
        //        unsigned char padding[] = {FSF::PAD,FSF::PAD};
        //        double da[]={M_PI,M_E};
        //        FSF::allocateBuf(256);
        //        FSF::fillBuf(padding,sizeof(padding));
        //        FSF::fillBuf(string("h"),true);
        //        FSF::fillBuf(da,2,true);
        //        FSF::sendBuf();

        mvox::Cube aortaCube; aortaCube.Data = nullptr;
        aortaCube.width = aortaCube.height = 512; aortaCube.depth = 113;
        aortaCube.Format = mvox::PixelFormat::Y;
        if(!read_cube(aortaCube, this->aortaCubeDatFile)) {
            sendText("error: can't read aortaCube");
            return true;
        }

        mvox::Cube vesselCube[2] = {aortaCube,aortaCube};
        if(!read_cube(vesselCube[0], this->vesselCubeDatFile[0])) {
            sendText("error: can't read vessel0.dat");
            return true;
        }

        if(!read_cube(vesselCube[1], this->vesselCubeDatFile[1])) {
            sendText("error: can't read vessel1.dat");
            return true;
        }

        size_t multiSize = 0;
        multiSize += FSF::evalSize(aortaCube);
        multiSize += FSF::evalSize(vesselCube[0]);
        multiSize += FSF::evalSize(vesselCube[1]);
        FSF::allocateBuf(multiSize);
        FSF::fillBuf(aortaCube);
        FSF::fillBuf(vesselCube[0]);
        FSF::fillBuf(vesselCube[1],true);
        FSF::writeBufToFile("string-cube.dat");
        FSF::sendBuf();
        //        string hello = "hello";
        //        FSF::allocateBuf(FSF::evalSize(hello));
        //        FSF::fillBuf(hello,true);
        //        FSF::appendBufToFile("string-cube.dat");

#endif

void FFRService::sendDoubleArray(double *arr, size_t len)
{
    // 0TTTyy00
    // LTTTyyDD, где DD - dimension,
    //  TTT - тип Int8,  Uint8,  Int16,  Uint16, Int32, Uint32, Float32, Float64; L - long dim
    // 0TTTyy01 dim_1(Uint16)					1-мерный массив типа TTT размерности [dim_1]
    // 0111yy01 zzzzzzzz zzzzzzzz padding 5 bytes [Float64Array]
    size_t sizeBytesArr = len*sizeof(double);
    unsigned char desc[8] = {0x71,0,0};
    desc[1] = (len>>8)&0xFF;
    desc[2] = len&0xFF;

    allocateBuf(sizeof(desc)+sizeBytesArr);
    unsigned char *buf = txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
    memcpy(buf,desc,sizeof(desc));
    memcpy(buf+sizeof(desc),arr,sizeBytesArr);
    sendBin(buf,sizeof(desc)+sizeBytesArr);
}

void FFRService::saveState4()
{
    // assert vesselInfo[] valid
    assert(this->vesselsObjectsCount);
    assert(this->vesselsCount);
    assert(this->aortaObject.Data);
    assert(this->vesselObject[0].Data);
    assert(this->vesselObject[1].Data);

    FSF::allocateBuf(FSF::evalSize(this->aortaObject));
    // unsigned char *buf = service->txbufBin.data + service->txbufBin.offset;
    FSF::fillBuf(this->aortaObject);
    // stringstream ss; ss <<"cube format="<<this->aortaObject.Format << " saveState4() aortaObject: "<<hex(buf,16,16);
    // tracer.log(string(ss.str()));
    FSF::writeBufToFile(this->state4);
    FSF::allocateBuf(FSF::evalSize(this->vesselObject[0]));
    FSF::fillBuf(this->vesselObject[0]);
    FSF::appendBufToFile(this->state4);
    FSF::allocateBuf(FSF::evalSize(this->vesselObject[1]));
    FSF::fillBuf(this->vesselObject[1]);
    FSF::appendBufToFile(this->state4);

    for(int i=0; i<this->vesselsCount; i++) {
        double *bifurcationPoints = (double *)this->vesselInfo[i].bifurcationPoints;
        int bifurcationPointsElems = this->vesselInfo[i].bifurcationsCount * 3;
        double *centerLinePoints = (double *)this->vesselInfo[i].centerLinePoints;
        int centerLinePointsElems = this->vesselInfo[i].centerLineCount * 3;
        size_t multiSize = 0;
        multiSize += FSF::evalSize(this->vesselInfo[i].name);
        multiSize += FSF::evalSize(bifurcationPoints,bifurcationPointsElems);
        multiSize += FSF::evalSize(centerLinePoints,centerLinePointsElems);
        FSF::allocateBuf(multiSize);
        FSF::fillBuf(this->vesselInfo[i].name);
        FSF::fillBuf(bifurcationPoints,bifurcationPointsElems);
        FSF::fillBuf(centerLinePoints,centerLinePointsElems);
        FSF::appendBufToFile(this->state4);
    }
}

bool FFRService::spawnBloodProcess(FFRServiceUserData *userData)
{
    bool res = false;
#ifdef __unix__
    pid_t pid = fork();

    if (pid == -1) {
        userData->errorText = "Unable to fork\n";
    } else if (pid > 0) {
        userData->pid = pid;
        MSec t0 = Tracer::msec();
        userData->sec = t0.sec;
        userData->msec = t0.msec;
        userData->errorText = nullptr;
        userData->tick = 6;
        res = true;
    } else {
        // we are the child монтирование тома: -v $CWD/FFR:/FFR
        char mountvolume[256], *cwd = get_current_dir_name();
        snprintf(mountvolume,sizeof(mountvolume),"%s/FFR:/FFR",cwd);
        free(cwd);
        tracer.log(string("mountvolume: ")+mountvolume);
        // tracer.log("changing dir to FFR");
        // chdir("FFR");
        //docker run --rm -v /home/germank/ATB/FFR:/FFR blood-wine:0.1
        if (execlp("docker", "docker", "run", "--rm", "-v", mountvolume, "blood-wine:0.1", NULL) == -1) {
            tracer.logInt("execlp returned -1; errno=",errno);
            tracer.log("child process exiting with status 127");
            exit(127);
        }
        tracer.log("execlp exited");    // это невозможно
    }
#else
    userData = "not implemented on Windows";
#endif

    return  res;
}

string hex(void *data, size_t len, int n)
{
    stringstream ss;
    int dumpBytes = (len < n ? len : n);
    unsigned char *buf = (unsigned char *)data;
    for(int i=0; i<dumpBytes; i++ )
        ss << " 0x" << std::hex << (int)buf[i];
    if(len > n)
        ss << "...";
    return ss.str();
}

void FFRService::parseLoadCubeCommand(void *buf, size_t len)
{
    tracer.log("FFRService::parseLoadCubeCommand()");
    this->sourceCube.Data = nullptr;
    setbuf(stdout,0);
    printf("FFRService::parseLoadCubeCommand(%p,%ld)\n",buf,len);
//    cout << hex(buf,len,24);
    // UID matrix4 matrix4 spacing FSD-cube
    FSF::FSFptr ptr = {buf,len};
    try {
        // cube UID[32] (sha-256)
        FSF::Array d0= FSF::parseArray(ptr); FSF::print(d0); Copy(d0,this->cubeUID);
        FSF::Array d1= FSF::parseArray(ptr); FSF::print(d1);        // ijk2LPS[16]
        float *d = (float *)d1.data;
        this->sourceCube.ImageToSpace = {d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],d[9],d[10],d[11],d[12],d[13],d[14],d[15]};
        FSF::Array d2= FSF::parseArray(ptr); FSF::print(d2);        // lps2IJK[16]
        d = (float *)d2.data;
        this->sourceCube.SpaceToImage = {d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],d[9],d[10],d[11],d[12],d[13],d[14],d[15]};
        FSF::Array d3= FSF::parseArray(ptr); FSF::print(d3);        // spacing[3]
        d = (float *)d3.data;
        this->sourceCube.scaleX = d[0]; this->sourceCube.scaleY = d[1]; this->sourceCube.scaleZ = d[2];
        FSF::Array dCube= FSF::parseArray(ptr); FSF::print(dCube);  // дескриптор cube<short>[][][]
        size_t cubeSize = dCube.size(); //int elems = FSF::elements(dCube.dims);
        this->sourceCube.Data = new char[cubeSize];
        this->sourceCube.width = dCube.dims[0];
        this->sourceCube.height = dCube.dims[1];
        this->sourceCube.depth = dCube.dims[2];
        this->sourceCube.Format = FSF::FSFtoCubeFormat(dCube.type);

        setupFrameContext(3/* LOAD CUBE cmd */,this->sourceCube.Data,cubeSize);

    }
    catch(const runtime_error &e) {
       printf("catch:%s\n",e.what());
       stringstream ss; ss << "error: "<< e.what();
       sendText(ss.str());
    }

}

void FFRService::setupFrameContext(int cmd, void *buf, size_t len)
{
    this->frameCtx = &this->frameContext;
    this->frameCtx->cmd = cmd;
    this->frameCtx->buf = this->frameCtx->bufPtr = buf;
    this->frameCtx->bytesExpected = this->frameCtx->bytesRemained = len;
    this->frameCtx->lastShownPercent = 0.0;
}

// сюда приходит управление, когда все данные в рамках контекста фрейма получены
void FFRService::endOfFrameContext()
{
    stringstream ss; ss<<"FFRService::endOfFrameContext():";
    ss << " получено байт " << this->frameCtx->bytesExpected;
    tracer.log(ss.str());

    if(this->frameCtx->cmd == 3 /*LOAD CUBE*/) {
        printCube(this->sourceCube);
        // sendText("ok");
    }

    this->frameCtx = nullptr;

}

// binary CMD: AortaSearch_FindAorta   (numCircles, minRadius, maxRadius) --параметры игнорируются
// 
// return: FSF{OK,IMG,Float32Array[n*(center,radius)]}, center дается в 3D
void FFRService::AortaSearch_FindAorta(void *buf, size_t len) {
    tracer.logInt("FFRService::AortaSearch_FindAorta() len=",len);
    string s = hex(buf, len, len); tracer.log(s.c_str());
    FSF::FSFptr ptr = {buf,len};
    unsigned short *params;
    try {
        FSF::Array d1= FSF::parseArray(ptr);
        params = (unsigned short *)d1.data;
        stringstream ss; 
        ss <<"params: "<< params[0] <<' ' << params[1] <<' '<< params[2];
        tracer.log(ss.str());
    }
    catch(const runtime_error &e) {
       stringstream ss; ss << "error: "<< e.what();
       sendError(255,ss.str());
       return;
    }

    // распаковка параметров. numCircles ограничиваем 6, больше бессмысленно
    #define MAX_NUM_CIRCLES 6
    // параметры 'sliceInd' 'numCircles' 'minRadius' 'maxRadius' принимаются, но игнорируются
    // эксперименты показали, что спуск по срезам в поисках подходящего все таки происходит
    // и параметры min/max радиус имеют вполне подходящие значения по умолчанию 10 и 35, а numCircles 2
    // поэтому они дальше не распространяются, а оставлены на всякий случай, вдруг пригодятся
    int numCircles = params[0] > MAX_NUM_CIRCLES ? MAX_NUM_CIRCLES : params[0];
    double minRadius = params[1], maxRadius = params[2];
    double cc[MAX_NUM_CIRCLES * 4];
    extern int AortaSearch_FindAorta(mvox::Cube sourceCube, double *circles);
    
    int n = AortaSearch_FindAorta(this->sourceCube, cc);

    if(n > 0) {
        // printf("AortaSearch_FindAorta returned center (%.3f %.3f %.3f) and radius %.3f\n",
        //        center.x,center.y,center.z,radius);

        mvox::Point3D_Double center = mvox::Point3D_Double(cc[0], cc[1], cc[2]);
        this->settings.AortaInitialPoint = center;
        this->settings.AortaRadius = cc[3];

        FILE *fd = fopen("aorta_slice_new.png","rb");

        if(!fd)
            sendError(255,"error: Cannot find aorta image");
        else {
            fseek(fd,0,SEEK_END);
            size_t size = ftell(fd);
            fseek(fd,0,SEEK_SET);
            char *data = new char[size];
            fread(data,size,1,fd);
            FSF::allocateBuf(80);

            // Формируем ответ <OK><img><double[4*n]>
            size_t par1Size = FSF::evalSize((unsigned char*)data,size);
            size_t ccSize = FSF::evalSize(cc,4*n);
            unsigned char msgOK[] = {FSF::OK,0};
            FSF::allocateBuf(sizeof(msgOK)+par1Size+ccSize);
            FSF::fillBuf((void *)msgOK,sizeof(msgOK));
            FSF::fillBufAsUint8Array((unsigned char*)data,size);
            FSF::fillBuf(cc,4*n);
            FSF::sendBuf();

            delete[] data;
            fclose(fd);
        }
    }
    else
        sendError(255,"Cannot find aorta center!");
}

void FFRService::Initialize(void *buf, size_t len) {
    tracer.log("FFRService::Initialize()");
    stringstream ss;

    FSF::FSFptr ptr = {buf,len};
    FSF::Array d1;
    try {
        d1= FSF::parseArray(ptr);
    }
    catch(const runtime_error &e) {
       stringstream ss; ss << "error: "<< e.what();
       sendError(255,ss.str());
       return;
    }

    float *params = (float *)d1.data;

    //tracer.logInt("params size",d1.size());
    if(d1.size() == 0) {
        tracer.log("Переданы пустые параметры. Будет использована точка, найденная FindAorta:");
    } else {
        // ss <<"params: "<< params[0] <<' ' << params[1] <<' '<< params[2] << ' ' << params[3];
        // tracer.log(ss.str());
        this->settings.AortaInitialPoint.x = params[0];
        this->settings.AortaInitialPoint.y = params[1];
        this->settings.AortaInitialPoint.z = params[2];
        this->settings.AortaRadius = params[3];
    }

    double p[] = {this->settings.AortaInitialPoint.x, this->settings.AortaInitialPoint.y, this->settings.AortaInitialPoint.z};
    ss << "center=("<<p[0]<<','<<p[1]<<','<<p[2]<<") radius="<< this->settings.AortaRadius;
    tracer.log(ss.str());

    this->FFR = FFR_Initialize(this->settings);

    sendText("ok");
}

// binary CMD: PrepareResult([{Front Rear percent}], [Psys,Pdia,SV,HR])              ## since 1.2.4.72
// 
// return: в FFRService::processUserData()
//
void FFRService::PrepareResult(void *buf, size_t len) {
    tracer.log("FFRService::PrepareResult()");
    FSF::FSFptr ptr = {buf,len};
    try {
        FSF::Array d0= FSF::parseArray(ptr); FSF::print(d0);
        FSF::Array d1= FSF::parseArray(ptr); FSF::print(d1);
        float *dd0 = (float *)d0.data, *dd1 = (float *)d1.data;

        //stringstream ss;
        // ss << " d0.ndims= " << d0.nDims << " dims[0]="<<d0.dims[0];
        // ss << " "<<dd0[i];
        // tracer.log(ss.str());    
        // for(int i=0; i<d1.dims[0]; i++)
        //     ss << " "<<dd1[i];
        // tracer.log(ss.str()); 

        //  Psys (mmHg), Pdia (mmHG), SV (ml), HR (bpm) (трактуем как int?)
        int Psys = dd1[0], Pdia = dd1[1], SV = dd1[2], HR = dd1[3];
        ofstream pout;
        pout.open("./FFR/patient.tre");
        pout << Psys <<'\n' << Pdia << '\n' << SV << '\n' << HR << '\n';
        pout.close();

        FFRStenosis stenosis[10];       // 10 - хардкод
        int stNum = d0.dims[0] / 7;     // assert(stNum < 10)
        for(int i=0; i<stNum; i++) {
            float x1=dd0[7*i+0], y1=dd0[7*i+1], z1=dd0[7*i+2];
            float x2=dd0[7*i+3], y2=dd0[7*i+4], z2=dd0[7*i+5];
            int UserStenosisPercent = (int)dd0[7*i+6];
            stenosis[i] = {1, Stenosis,  {{0, 0, 0},5}, {{x1, y1, z1},5}, {{x2, y2, z2},5}, UserStenosisPercent };
        }

        FFR_PrepareResult(this->FFR, stenosis,stNum, mywriter);

        // запускаем процесс blood
        lws_context *context = lws_get_context(this->wsi);
        FFRServiceUserData * userData = (FFRServiceUserData *)lws_context_user(context);
        if(!this->spawnBloodProcess(userData))
            sendText("error: cant start blood.exe process");
    }
    catch(const runtime_error &e) {
       printf("catch:%s\n",e.what());
       stringstream ss; ss << "error: "<< e.what();
       sendText(ss.str());
    }
}


// создать новый куб из исходного маркируя воксели со значением targetCode как 1, а остальные 0
void repackCubeAsBoolean(mvox::Cube cube, uint8_t targetCode) {
    if(cube.Format != mvox::PixelFormat::Y)  return;
    size_t len = cube.width * cube.height * cube.depth;
    char *data = (char *)cube.Data; int cnt = 0;
    for(int i=0; i<len; i++) {
        data[i] = (data[i] == targetCode ? 1 : 0);
        if(data[i] == targetCode) cnt++;
    }
}

void FFRService_update_progres(float relativeProgress, const wchar_t* status) {
    assert(service);
    service->updateProgress(relativeProgress,status);
}



#if 0
//        aortaCube.depth *= 3;
//        size_t len = aortaCube.width * aortaCube.height * aortaCube.depth;
//        service->allocateBuf(len);
//        unsigned char *buf = txbufBin.data + LWS_SEND_BUFFER_PRE_PADDING;
//        aortaCube.Data = buf;
//        FSF::send(aortaCube,true);

        // посылаем пакетом string+cube
        string str = "Привет";
        mvox::Cube cube; cube.width = cube.height = cube.depth = 1;
        cube.Format = mvox::PixelFormat::Y;
        unsigned char data[] = {1};
        cube.Data = data;

        size_t multiSize = 0;
        multiSize += FSF::evalSize(str);
        multiSize += FSF::evalSize(cube);
        FSF::allocateBuf(multiSize);
        FSF::fillBuf(str);
        FSF::fillBuf(cube,true);
        FSF::sendBuf();
        //tracer.logInt("multiSize",(int)multiSize);
        //FSF::send(cube,true);

        //        FSF::send("Привет",false);
        //        mvox::Cube cube; cube.width = cube.height = cube.depth = 1;
        //        unsigned char data[] = {1}; cube.Data = data;
        //        FSF::send(cube, true);

                //sendText("error: not implemented yet");


#endif

void printCube(mvox::Cube cube)  {
    setbuf(stdout,0);
    printf("mvox::Cube[%d %d %d] format %d spacing=[%f %f %f]\n",
           cube.width, cube.height, cube.depth, cube.Format, cube.scaleX, cube.scaleY, cube.scaleZ);
    mvox::Matrix4x4<float> a = cube.SpaceToImage;
    printf("SpaceToImage:[%f %f %f %f %f %f %f %f %f %f %f %f %f %f %f %f ]\n",
           a.M11,a.M12,a.M13,a.M14,a.M21,a.M22,a.M23,a.M24,a.M31,a.M32,a.M33,a.M34,a.M41,a.M42,a.M43,a.M44);
    a = cube.ImageToSpace;
    printf("ImageToSpace:[%f %f %f %f %f %f %f %f %f %f %f %f %f %f %f %f ]\n",
           a.M11,a.M12,a.M13,a.M14,a.M21,a.M22,a.M23,a.M24,a.M31,a.M32,a.M33,a.M34,a.M41,a.M42,a.M43,a.M44);
}
