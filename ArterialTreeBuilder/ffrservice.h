#ifndef FFRSERVICE_H
#define FFRSERVICE_H
#include <cstddef>
#include <libwebsockets.h>
#include <string>
#include "mvox.h"
using namespace std;

/*
 * Это интерфейсный класс, который реализует ffr-protocol через вебсокет.
 * Он получает команды от UI, организует их выполнение через вызов FFR_* процедур
 * и возвращает результаты обратно. То есть по отношению к FFR_* процедурам, это
 * та оболочка, роль которой выполнял Мультивокс
 */
#define EXAMPLE_RX_BUFFER_BYTES (256)
class FFRProcessor;
class FSF;
/*
 * Это часть контекста вебсокета. Она создается при создании контекста в lws.cpp
 * и содержит в себе информацию о запущенном процессе blood.exe. Сам процесс запускается
 * при обработке команды PrepareResult и затем мониторится на каждом цикле LWSService
 */
struct FFRServiceUserData {
    int         pid;    // -1 - нет процесса
    time_t      sec;    // время запуска процесса секунда и милисекунда
    unsigned    msec;
    int         tick;   // цена 1% прогресса в секундах
    const char *errorText;
    int         status; // status окончания процесса
};

/*
 * Контекст двоичного фрейма. Он позволяет определить, что делать, когда приходит новый фрейм
 */
struct FFRFrameContext {
    int     cmd;        // команда
    void    *buf;       // начало буфера данных
    size_t  bytesExpected;    // размер ожидаемых данных
    size_t  bytesRemained;    // размер оставшихся данных
    void    *bufPtr;    // текущий указатель по буферу
    float   lastShownPercent;   // для progress bar
};

class FFRService
{
public:
    FFRService();
    FFRService(struct lws *wsi);
    static const char *version();
    void frameRecieved(void *data, size_t len);
    void frameRecievedBinary(struct lws *wsi, void *user, void *data, size_t len);


    // public для callback функции
    void sendText(const string & msg);
    void processUserData(lws_context *context);

    // Управление Update Progress
    // --------------------------
    // Операции FFR_Process_PrepareAortaProc FFR_Process_PrepareVesselsProc и FFR_Process
    // во время обработки посылают на клиента оповещения о прогрессе и получают во входных
    // параметрах callback функцию для оповещения. Поэтому перед вызовом этих операций
    // парсер протокола разрешает отсылку оповещений на клиент через вызов
    // enableUpdateProgress(true) и запрещает после их выполнения. Сама callback функция
    // FFRService_update_progres сделана глобальной, чтобы ее можно было использовать и в тех
    // подпрограммах, которые ничего не знают об FFRService. FFRService_update_progres() является
    // оберткой вокруг FFRService::updateProgress() и в случае, если отсылка оповещения не разрешена,
    // то оно попадает только в лог
    //
    void enableUpdateProgress(bool enable) {this->updateProgressEnabled = enable;}
    void updateProgress(float relativeProgress, const wchar_t* status);


    friend class FSF;

private:
    struct lws *wsi;
    FFRProcessor *FFR = nullptr;
    mvox::Cube sourceCube;
    unsigned char cubeUID[32];
    FFRSettings settings;

    struct payload
    {
        unsigned char data[LWS_SEND_BUFFER_PRE_PADDING + EXAMPLE_RX_BUFFER_BYTES + LWS_SEND_BUFFER_POST_PADDING];
        size_t len;
    } txbufText;

    struct
    {
        unsigned char *data;
        size_t len;     // длина рабочей области (без PADDING) в data
        size_t offset;  // свободное место в буфере (относительно data т.е. offset всегда >= LWS_SEND_BUFFER_PRE_PADDING)
    } txbufBin = {nullptr,0};

    void sendBin(void *data, size_t len);
    void sendOK();
    void sendError(int code, string reason);
    void *allocateBuf(size_t len);
    void sendBuf(size_t len);
    void releaseBuf();
    mvox::Cube allocateSegmCube();
    bool processTestMessage(const string & msg);
    void sendDoubleArray(double *arr,size_t len);

    // файлы для load state4 (это под Почукаеву-113)
    //
    const string state4 = "state4.dat";
    mvox::Cube aortaObject;
    int vesselsCount=0;
    mvox::Cube vesselObject[2]; //[vesselsCount]
    int vesselsObjectsCount=0;
    struct {
        string name;
        int bifurcationsCount;
        mvox::Point3D_Double *bifurcationPoints;
        int centerLineCount;
        mvox::Point3D_Double *centerLinePoints;
    } vesselInfo[30];    // [vesselsObjectsCount]

    void saveState4();

    bool spawnBloodProcess(FFRServiceUserData *userData);

    // для FFR binary
    FFRFrameContext frameContext, *frameCtx = nullptr;

    // команды двоичного протокола
    void parseLoadCubeCommand(void *buf, size_t len);
    void AortaSearch_FindAorta(void *buf, size_t len);
    void Initialize(void *buf, size_t len);
    void PrepareResult(void *buf, size_t len);

    void setupFrameContext(int cmd, void *buf, size_t len);
    void endOfFrameContext();

    bool updateProgressEnabled = false;
    // если Threshold, переданный в Thining отличается от последнего переданного в LoadVesselsPreview
    // то перед Thining принудительно делается LoadVesselsPreview с этим порогом
    float lastLoadVesselsPreviewThreshold = 0.0;

};

extern string hex(void *buf, size_t len, int n = 8);


#endif // FFRSERVICE_H
