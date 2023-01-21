#include "tracer.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <time.h>
#ifdef __linux__
#include <sys/time.h>       // UNIX
#include <sys/resource.h>   // rusage
#elif _WIN32
#include <sys/timeb.h>
#endif
#include "mvox.h"
#include <vector>   // нужен для vtb.hpp
#include <cassert>  // нужен для vtb.hpp
#include "vtb.hpp"
using namespace std;

Tracer::Tracer()
    :Tracer("trace.txt")
{
}

Tracer::Tracer(std::string tracefile)
    :tracefile(tracefile)
{
    log("==========================trace starts======================");
    this->s0 = Tracer::msec().sec;
}

Tracer::~Tracer()
{
    this->s1 = Tracer::msec().sec;
    stringstream ss; ss << "==========================trace ends " << (s1-s0) <<" sec ======================";
    log(ss.str());
}

void Tracer::log(std::string str, string terminationString)
{
    MSec msec = Tracer::msec(); // текущая секунда и милисекунда
    std::ofstream o(tracefile,std::ios_base::app);
    //stringstream ts; ts << sec << '.' << msec <<' ';
    struct tm *_tm = localtime(&msec.sec);
    int y=_tm->tm_year, m=_tm->tm_mon, d=_tm->tm_mday, h=_tm->tm_hour, min=_tm->tm_min, s=_tm->tm_sec;
    stringstream ts; ts <<1900+y<<'.'<<m+1<<'.'<<d<<' '<<h<<':'<<min<<':'<<s<<'.'<<msec.msec<<' ';
#ifdef __linux__
    struct rusage usage;
    getrusage(RUSAGE_SELF,&usage);
    ts << "[RSS "<<usage.ru_maxrss<<"] ";
#endif

    // если строка начинается с '-', то подавляем выдачу TimeStamp
    bool need_ts = true;
    if(str[0] == '-') {
        str.erase(0,1);
        need_ts = false;
    }

    stringstream ss; ss << (need_ts ? ts.str() : "") << str << terminationString;
    cout << ss.str();
    o << ss.str();
    o.close();
}

void Tracer::logInt(std::string name, int val)
{
    stringstream ss; ss << name<<"="<<val;
    this->log(ss.str());
}

MSec Tracer::msec()
{
    time_t sec;
    unsigned msec = 0;
#ifdef __linux__
    struct timeval tv; struct timezone tz;
    gettimeofday(&tv, &tz);
    sec  = tv.tv_sec;
    msec = tv.tv_usec/1000;
#elif _WIN32
    struct timeb lt1; ftime(&lt1);
    sec = lt1.time;
    msec = lt1.millitm;
#endif
    MSec res = {sec, msec};
    return res;
}

void Tracer::startInterval(string label)
{
    MSec t0 = Tracer::msec();
    this->intervals[label] = std::make_pair(t0,t0);
}

void Tracer::stopInterval(string label)
{
    auto it = this->intervals.find(label);
    if(it != this->intervals.end())
        it->second.second = Tracer::msec();
    else
        cout << "Tracer::stopInterval() no interval " << label << endl;
}

double Tracer::getInterval(string label)
{  
    auto it = this->intervals.find(label);
    if(it == this->intervals.end()) return 0.0;
    stopInterval(label);
    double t0 = it->second.first.sec+it->second.first.msec*0.001;
    double t1 = it->second.second.sec+it->second.second.msec*0.001;
//    cout<<'*' << it->second.first.sec<<' '<<it->second.first.msec<<' '<< it->second.second.sec<<' '<<it->second.second.msec<<endl;
    return (t1-t0);
}

void Tracer::logInterval(string label)
{
    stopInterval(label);
    stringstream ss; ss << label<<":"<<getInterval(label);
    this->log(ss.str());
}

struct NonZeroStats {
    int ROI[6];
    int total,nonzero,first,last;   // всего вокселей,ненулевых, первый ненулевой, последний ненулевой (лин. индексы)
    unsigned long long usum;
};
static NonZeroStats cube_nonzero_stats(mvox::Cube cube);
static std::string cube_nonzero_str(mvox::Cube cube, string pref="");
static NonZeroStats cube_targetcode_stats(mvox::Cube cube,uint8_t targetCode);
static std::string cube_targetcode_str(mvox::Cube cube, uint8_t targetCode, string pref="");
static unsigned long long cube_usum(mvox::Cube cube);
static string points_to_string(mvox::Point3D_Double* dest, int count, string pref, int limit=-1);
// write_cube
//
void write_cube(mvox::Cube cube, string filename) {
    int pixelSize = mvox::PixelFormatUtils::PixelFormatBytesPerPixel(cube.Format);
    FILE *fd = fopen(filename.c_str(),"wb");
    if(!fd) {tracer.log(string("can't open ")+filename); return;}
    int numPixels = cube.width * cube.height * cube.depth;
    size_t size = numPixels  * pixelSize;
    tracer.log(string("writing ")+std::to_string(size)+string(" bytes to ")+filename+" ..");
    fwrite(cube.Data,size,1,fd);
    tracer.log("ok");
    fclose(fd);
}

// read_cube
//
bool read_cube(mvox::Cube & cube, string filename) {
    cube.Data = nullptr;
    bool res = false;
    int pixelSize = mvox::PixelFormatUtils::PixelFormatBytesPerPixel(cube.Format);
    FILE *fd = fopen(filename.c_str(),"rb");
    if(!fd) {tracer.log(string("can't open ")+filename); return false;}
    int numPixels = cube.width * cube.height * cube.depth;
    size_t size = numPixels  * pixelSize;
    fseek(fd,0,SEEK_END);
    if(ftell(fd) == size) {
        fseek(fd,0,SEEK_SET);
        cube.Data = new char[size];
        tracer.log(string("reading ")+std::to_string(size)+string(" bytes from ")+filename,"...");
        fread(cube.Data,size,1,fd);
        tracer.log("-ok");
        res = true;
    } else {
        stringstream ss; ss << "file size " << ftell(fd) << " and required size " << size <<" differ";
        tracer.log(ss.str());
    }

    fclose(fd);
    return res;
}


/*
 * Вспомогательные функции трассировки. Вызываются в прологе и иногда эпилоге функций FFR_*
 *
 */
//--------------------- для AortaSearch_FindAorta
static void t_AortaSearch_printSlices(mvox::Cube cube) {
    short* slice = (short*)cube.Data;
    int sliceIndex = cube.depth - 1;
    slice += sliceIndex * cube.width * cube.height;
    
    int  tmp_size[2] = { cube.width, cube.height };
    double tmp_spacing[2] = { 1,1 };
    char filename[64]; sprintf(filename,"aorta_slice-%d.png",sliceIndex);
    Utils::printSliceOnPng(filename, slice, tmp_size, tmp_spacing);
}

// найти соотношение dark/white пикселе на срезе
//
static void  t_AortaSearch_dark_white(mvox::Cube cube) {
    ofstream o; o.open("dark-white.txt",std::ofstream::out); // | std::ofstream::app   
    for(int sliceInd = 0; sliceInd < cube.depth; sliceInd++) {
        short* slice = (short*)cube.Data + sliceInd * cube.width * cube.height;
        // фоновый пиксель определяем как min(slice[0][0],slice[0][1])
        // например в сканерах Toshiba slice[0][0] равен 0, в то время как фоновый пиксель это -2048
        short dark = (slice[0] < slice[1] ? slice[0] : slice[1]);
        int darkCnt = 0, whiteCnt = 0;
        for(int i=0; i<cube.width; i++)
            for(int j=0; j<cube.height; j++) {
                short *v = slice+j*cube.width+i;
                if(*v == dark)
                    darkCnt++;
                else
                    whiteCnt++;            
            }
        o << "[" << sliceInd << "] " << " dark/white="<<darkCnt<<'/'<<whiteCnt  <<endl;;
    }
    o.close();
}

// найти среднюю величину интенсивности в данном срезе аорты и число темных/светлых пикселей
//
static float  t_AortaSearch_avg_HU(mvox::Cube cube, AortaSearch_FindAorta_stat *stat) {
    if(!stat->result) return 0.0;
    short* slice = (short*)cube.Data;
    int sliceIndex = stat->sliceIndex;
    slice += sliceIndex * cube.width * cube.height;
    int r2 = stat->rad*stat->rad;
    long sum=0; int n=0; short dark = (slice[0] < slice[1] ? slice[0] : slice[1]);
    stat->dark = stat->white = 0;
    for(int i=0; i<cube.width; i++)
        for(int j=0; j<cube.height; j++) {
            int dx = i-stat->IJ[0], dx2=dx*dx;
            int dy = j-stat->IJ[1], dy2=dy*dy;
            short *v = slice+j*cube.width+i;
            if(*v == dark)
                stat->dark++;
            else
                stat->white++;            
            if(dx2+dy2 < r2) {                
                sum += *v;
                n++;
            }
        }
    stat->avgHU = (sum * 1.0) / n;
    return stat->avgHU;
}

void t_AortaSearch_FindAorta(mvox::Cube cube) {
    std::stringstream ss;
    ss << "AortaSearch_FindAorta(..)" <<" Cube.dims=["<<cube.width<<','<<cube.height<<','<<cube.depth<<']';
    ss << " spacing=("<<cube.scaleX<<','<<cube.scaleY<<','<< cube.scaleZ<<')';
    tracer.log(ss.str());

    // t_AortaSearch_FindAorta_1(cube);
    //t_AortaSearch_dark_white(cube);
}

void t_AortaSearch_FindAorta_fin(mvox::Cube cube, double* circles, int n) {
    std::stringstream ss;
    ss << "AortaSearch_FindAorta returned "<<n<<" circles";
    tracer.log(ss.str());
}

void t_FFR_Initialize(FFRSettings s) {
    std::stringstream ss; ss<<"FFR_Initialize(FFRSettings)\n";
    ss << "FFRSettings={AortaInitialPoint=(" << s.AortaInitialPoint.x<<','<<s.AortaInitialPoint.y<<','<<s.AortaInitialPoint.z<<"),";
    ss << "AortaRadius="<<s.AortaRadius<<", AortaAverageIntensity="<<s.AortaAverageIntensity<<", ";
    ss << "idtStopParameter="<<s.idtStopParameter<<", aortaThreshold="<<s.aortaThreshold<<", ";
    ss << "maxNoiseLength="<<s.maxNoiseLength<<", frangiThreshold="<<s.frangiThreshold<<", ";
    ss << "minDistBetweenOstia="<<s.minDistBetweenOstia<<", minNumOfVoxelsInBranch="<<s.minNumOfVoxelsInBranch<<"}";

    tracer.log(ss.str());
}

void t_FFR_Process_PrepareAortaProc(FFRProcessor* , mvox::Cube , mvox::UpdateProgress ) {
    std::stringstream ss; ss << "FFR_Process_PrepareAortaProc(FFR,cube,progress)";
    tracer.log(ss.str());
    tracer.startInterval("FFR_Process_PrepareAortaProc");
}
void t_FFR_Process_PrepareAortaProc_fin(mvox::Cube sourceCube) {
    // Результатом выполнения FFR_Process_PrepareAortaProc() является вычисление воксельной маски
    // FFR->vtb->aortaMask = new bool[n];
    //
    double tt = tracer.getInterval("FFR_Process_PrepareAortaProc");
    std::stringstream ss; ss << "FFR_Process_PrepareAortaProc returns (see log_datainfo.txt) in "<<tt<<" sec";
    tracer.log(ss.str());
}
void t_FFR_GetOptimalTau(FFRProcessor*) {
    tracer.log("FFR_GetOptimalTau()");
}

void t_FFR_Process_LoadAortaPreview(FFRProcessor* processor, mvox::Cube segmCube, uint8_t targetCode, double tau) {
    std::stringstream ss;
    ss << "FFR_Process_LoadAortaPreview(FFR,cube,targetCode="<<(int)targetCode<<",tau="<<tau<<")";
    tracer.log(ss.str());
    tracer.startInterval("FFR_Process_LoadAortaPreview()");
}
void t_FFR_Process_LoadAortaPreview_fin(mvox::Cube segmCube, uint8_t targetCode) {
    // Результатом работы FFR_Process_LoadAortaPreview является байтовый куб, промаркированный 'targetCode' на вокселях аорты
    double tt = tracer.getInterval("FFR_Process_LoadAortaPreview()");
    std::stringstream ss; ss << "FFR_Process_LoadAortaPreview returns in "<<tt<<" sec";
//    ss << " cube(Y).dims=["<<segmCube.width<<','<<segmCube.height<<','<<segmCube.depth<<"]";
//    ss << "\n" << cube_targetcode_str(segmCube,targetCode,"AortaPreviewCube");
    tracer.log(ss.str());
}

static NonZeroStats cube_nonzero_stats(mvox::Cube cube) {
    NonZeroStats s0 = {0,0,-1,-1, 0};
    if(cube.Data) {
        char * data = (char *)cube.Data;
        for(int k=0; k<cube.depth; k++)
            for(int j=0; j<cube.height; j++)
                for(int i=0; i<cube.width; i++)
                 {
                    s0.total++;
                    int n = cube.IJK2lin(i,j,k);
                    if(data[n]) {
                        s0.nonzero++;
                        if(s0.first == -1) s0.first = n;
                        s0.last = n;
                    }
                }
        //s0.usum = cube_usum(cube);
    }
    return s0;
}

static std::string cube_nonzero_str(mvox::Cube cube, string pref) {
    NonZeroStats s0 = cube_nonzero_stats(cube);
    std::stringstream ss;
    ss << pref << ":non-zero-stats=(total="<<s0.total<<",nonzero="<<s0.nonzero<<",first="<<s0.first;
    ss <<",last="<<s0.last/*<<",usum="<<s0.usum*/<<')';
    return ss.str();
}

static NonZeroStats cube_targetcode_stats(mvox::Cube cube,uint8_t targetCode) {
    NonZeroStats s0 = {{10000,-1,10000,-1,10000,-1},0,0,-1,-1};   // 10000 - это +бесконечность
    if(cube.Data) {
        uint8_t * data = (uint8_t *)cube.Data;
        for(int k=0; k<cube.depth; k++)
            for(int j=0; j<cube.height; j++)
                for(int i=0; i<cube.width; i++)
                 {
                    s0.total++;
                    int n = cube.IJK2lin(i,j,k);
                    if(data[n] == targetCode) {
                        s0.nonzero++;
                        if(s0.first == -1) s0.first = n;
                        s0.last = n;
                        if(s0.ROI[0] > i) s0.ROI[0] = i;
                        if(s0.ROI[1] < i) s0.ROI[1] = i;
                        if(s0.ROI[2] > j) s0.ROI[2] = j;
                        if(s0.ROI[3] < j) s0.ROI[3] = j;
                        if(s0.ROI[4] > k) s0.ROI[4] = k;
                        if(s0.ROI[5] < k) s0.ROI[5] = k;
                    }
                }
    }
    return s0;
}

static std::string cube_targetcode_str(mvox::Cube cube,uint8_t targetCode, string pref) {
    NonZeroStats s0 = cube_targetcode_stats(cube,targetCode);
    std::stringstream ss;
    ss << pref << ":non-zero-stats=(total="<<s0.total<<",nonzero="<<s0.nonzero<<",first="<<s0.first<<",last="<<s0.last<<')';
    ss << " ROI=["<<s0.ROI[0]<<'x'<<s0.ROI[1]<<','<<s0.ROI[2]<<'x'<<s0.ROI[3]<<','<<s0.ROI[4]<<'x'<<s0.ROI[5]<<']';
    return ss.str();
}

// суммируем содержимомое куба, рассматривая его как uchar[]
static unsigned long long cube_usum(mvox::Cube cube) {
    unsigned long long sum = 0;
    unsigned char *data = (unsigned char *)cube.Data;
    int size = cube.width*cube.height*cube.depth;
    for(int i=0; i<size; i++)
        sum += data[i];
    return sum;
}

static string points_to_string(mvox::Point3D_Double* dest, int count, string pref, int limit) {
    stringstream ss; ss << pref << ":";
    for(int i=0; i<count; i++) {
        if(limit != -1 && i >= limit) break;
        ss << " ("<<dest[i].x<<","<<dest[i].y<<","<<dest[i].z<<")";
    }
    return ss.str();
}

void t_FFR_Process_PrepareVesselsProc(FFRProcessor* processor,mvox::Cube sourceCube,mvox::UpdateProgress progressFunction,VesselsSegmParameters p) {
    std::stringstream ss; ss << "FFR_Process_PrepareVesselsProc(FFR,cube,progress,";
    ss << "VesselsSegmParameters={AortaTau="<<p.AortaTau<<",Alpha="<<p.Alpha<<",Beta="<<p.Beta<<",Gamma="<<p.Gamma<<"})";
    tracer.log(ss.str());
    tracer.startInterval("FFR_Process_PrepareVesselsProc");
}

void t_FFR_Process_PrepareVesselsProc_fin(mvox::Cube cube, bool *aortaMask, bool *nearAortaMask) {
    // параметр cube передан сюда для удобства, чтобы не брать dims[] со стороны
    double tt = tracer.getInterval("FFR_Process_PrepareVesselsProc");
    std::stringstream ss; ss << "FFR_Process_PrepareVesselsProc returns in "<<tt<<" sec";
    // появляются aorta_surfac.stl  aorta_surface_smoothed.stl, несколько неинформативных логов
    // меняется VTB::aortaMask VTB:: Vesselness = new double[n]; nearAortaMask = new bool[n];
    // они переданы как параметры

//    cube.Format = mvox::PixelFormat::Y;
//    cube.Data = aortaMask; ss << cube_nonzero_str(cube," aortaMask");
//    cube.Data = nearAortaMask; ss << "\n" << cube_nonzero_str(cube," nearAortaMask");
    tracer.log(ss.str());
}

void t_FFR_Process_SetVesselsSeeds(FFRProcessor* processor, mvox::Point3D_Double* seedPoints, int count) {
    std::stringstream ss; ss << "FFR_Process_SetVesselsSeeds(FFR,seedPoints["<<count<<"])";
    for(int i=0; i<count; i++)
        ss << "points["<<i<<"]=("<<seedPoints[i].x<<","<<seedPoints[i].y<<","<<seedPoints[i].z<<")\n";
    tracer.log(ss.str());
}

void t_Vesselness(VTB *vtb) {
    tracer.logInt("n=",vtb->n);
    double temp = 0, maxVal1 = 0; int ostia1=-1;   
    for (int i = 0; i < vtb->n; ++i)
        if (vtb->nearAortaMask[i]) {
            temp = vtb->Vesselness[i];
            if (temp > maxVal1) {
                ostia1 = i;
                maxVal1 = temp;
            }
        }
    tracer.logInt("ostia1=",ostia1);  
    int x = ostia1 % vtb->dim[0], y = ostia1 / vtb->dim[0] % vtb->dim[1];
    int z = ostia1 / (vtb->dim[1] * vtb->dim[0]);
    stringstream ss; ss << "ostia1="<<ostia1<<"["<<x<<","<<y<<","<<z<<"]";
    tracer.log(ss.str());
    /// "ostia1 = [" << ostia1 % dim[0] << ", " << ostia1 / dim[0] % dim[1] << ", " << ostia1 / (dim[1] * dim[0]) << "]" << endl;  
}
void t_FFR_Process_LoadVesselsPreview(FFRProcessor *,mvox::Cube cube,unsigned char targetCode,double threshold, VTB *vtb) {
    stringstream ss; ss << "FFR_Process_LoadVesselsPreview(FFR,cube(Y),targetCode="<<(int)targetCode<<",threshold="<<threshold<<")";
    //ss << cube_targetcode_str(cube,targetCode,"VesselsPreviewCube");
    tracer.log(ss.str());
    tracer.startInterval("FFR_Process_LoadVesselsPreview");
}
void t_FFR_Process_LoadVesselsPreview_fin(FFRProcessor*,mvox::Cube cube,unsigned char targetCode, VTB *vtb) {
    double tt = tracer.getInterval("FFR_Process_LoadVesselsPreview");
    stringstream ss; ss << "FFR_Process_LoadVesselsPreview_fin(VTB) returns in "<<tt<<" sec";
    //ss <<'\n'<< cube_targetcode_str(cube,targetCode,"VesselsPreviewCube");
    tracer.log(ss.str());

    // здесь можно проанализировать Vesselness[]
    //t_Vesselness(vtb);
}

void t_nonzero() {
    char a[][5] = {{0,0,1,0,1},{0,0,1,0,1}};
    mvox::Cube cube = {a,mvox::PixelFormat::Y,5,2,1};
    tracer.log(cube_targetcode_str(cube,1));
}

/*
 * в начале работы в vtb->vesselComponents (а почему он short[], а не byte ?) некоторые воксели
 * промаркированы 1, что означает left vessel, или 2 то есть right vesssel, остальные видимо равны 0
 * это предположение проверяет t_FFR_Process_assert_1(cube)
 */
void t_FFR_Process(FFRProcessor*FFR ,mvox::Cube cube,mvox::UpdateProgress ,CompleteParameters p, VTB *vtb) {
    //  cube.Format== sY2
    stringstream ss; ss << "FFR_Process(FFR,cube(Y),CompleteParameters={";
    ss << "AortaTau="<<p.VesselParameters.AortaTau<<",Alpha="<<p.VesselParameters.Alpha;
    ss << ",Beta="<<p.VesselParameters.Beta<<",Gamma="<<p.VesselParameters.Gamma<<",VesselsThreshold="<<p.VesselsThreshold<<"})";
    tracer.log(ss.str());
    assert(vtb->vesselComponents);  // short[]
    assert(vtb->aortaMask);         // bool[]
    //t_FFR_Process_assert_1(vtb);
    //t_FFR_Process_assert_2(vtb);
    tracer.startInterval("FFR_Process");
}
void t_FFR_Process_trace(VTB *vtb) {
    tracer.log("t_FFR_Process_probe");
}

void t_FFR_Process_fin(int cursor) {
    double tt = tracer.getInterval("FFR_Process");
    stringstream ss; ss << "FFR_Process returns in "<<tt<<" sec";
    tracer.log(ss.str());
//    tracer.logInt("FFR_Process returns cursor",cursor);
}
//----------вспомогательные функции для t_FFR_Process
void t_FFR_Process_assert_1(VTB *vtb) {
    tracer.log(" t_FFR_Process_assert_1: vtb->vesselComponents[] содержит только 0,1 или 2","..");
    int size = (int)(vtb->dim[0]*vtb->dim[1]*vtb->dim[2]);
    int c0=0,c1=0,c2=0,vtb_vesselComponents_counter_other_than_0_1_or_2 = 0;
    short *data = vtb->vesselComponents;
    for(int i=0; i<size; i++) {
        if(data[i] == 0) c0++;
        else if(data[i] == 1) c1++;
        else if(data[i] == 2) c2++;
        else vtb_vesselComponents_counter_other_than_0_1_or_2++;
    }
//    stringstream ss; ss << " {c0="<<c0<<",c1="<<c1<<",c2="<<c2<<",other="<<vtb_vesselComponents_counter_other_than_0_1_or_2<<"}";
//    tracer.log(ss.str());
    bool valid = (vtb_vesselComponents_counter_other_than_0_1_or_2 == 0);
    tracer.log(valid ? "-true" : "-false");
    hassert(valid);
}
// проверка того, что
void t_FFR_Process_assert_2(VTB *vtb) {
    tracer.log(" t_FFR_Process_assert_2: vtb->vesselComponents содержит только нулевые пиксели на границе","..");
    int size = (int)(vtb->dim[0]*vtb->dim[1]*vtb->dim[2]);
    short *data = vtb->vesselComponents;
    int cntBorderPixels = 0;
    for(int i=0; i<size; i++)
        if(data[i]) {
            int I = i % vtb->dim[0], J = (i / vtb->dim[0]) % vtb->dim[1], K = i / (vtb->dim[0] * vtb->dim[1]);
            if(I==0 || I==vtb->dim[0] || J==0 || J==vtb->dim[1] || K==0 || K==vtb->dim[2]) cntBorderPixels++;
        }
    tracer.log(cntBorderPixels==0 ? "-true" : "-false");
}
//----------
void t_FFR_LoadAortaObject(FFRProcessor* ,mvox::Cube cube,uint8_t targetCode) {
    stringstream ss; ss << "FFR_LoadAortaObject(FFR,cube(Y),targetCode="<<(int)targetCode<<")";
    // ss <<"\n " << cube_targetcode_str(cube,targetCode,"AortaCube");
    // tracer.log(ss.str());
    tracer.startInterval("FFR_LoadAortaObject");
}
void t_FFR_LoadAortaObject_fin(mvox::Cube cube,uint8_t targetCode) {
    double tt = tracer.getInterval("FFR_LoadAortaObject");
    stringstream ss; ss << "FFR_LoadAortaObject_fin(cube(Y),targetCode="<<(int)targetCode<<")  returns in "<<tt<<" sec";
    ss <<"\n " << cube_targetcode_str(cube,targetCode,"AortaCube");
    tracer.log(ss.str());
}

void t_FFR_GetVesselsObjectsCount(FFRProcessor* ) {
    tracer.log("FFR_GetVesselsObjectsCount()");
}

void t_FFR_LoadVesselsObject(FFRProcessor* ,mvox::Cube cube,uint8_t targetCode,int vesselObjectIndex) {
    stringstream ss; ss << "FFR_LoadVesselsObject(FFR,cube(Y),targetCode="<<(int)targetCode<<",vesselObjectIndex="<<vesselObjectIndex<<")";
    ss <<"\n " << cube_targetcode_str(cube,targetCode,"cube(Y)");
    tracer.log(ss.str());
}
void t_FFR_LoadVesselsObject_fin(mvox::Cube cube,uint8_t targetCode,int vesselObjectIndex) {
    stringstream ss; ss << "FFR_LoadVesselsObject_fin(cube(Y),targetCode="<<(int)targetCode<<",vesselObjectIndex="<<vesselObjectIndex<<")";
    ss <<"\n " << cube_targetcode_str(cube,targetCode,"cube(Y)");
    tracer.log(ss.str());
}

void t_FFR_GetVesselsCount(FFRProcessor* ) {
    tracer.log("FFR_GetVesselsCount(FFR)");
}
void t_FFR_GetVesselInfo(FFRProcessor* , int vesselIndex, int* centerLineCount, int* bifurcationsCount, wchar_t* name) {
    stringstream ss; ss << "FFR_GetVesselInfo(FFR,vesselIndex="<<vesselIndex<<")";
    tracer.log(ss.str());
}
void t_FFR_GetVesselInfo_fin(FFRProcessor* , int vesselIndex, int* centerLineCount, int* bifurcationsCount, wchar_t* name) {
    wstring vesselName = name; stringstream ss; char buf[64]; int maxlen = sizeof(buf)-1,i;
    for(i=0; i<vesselName.size() && i<maxlen; i++)
        buf[i] = (char)name[i];    // вот не нашел другого способа работать с wstring
    if(buf[i-1] == '\n') buf[i-1] = 0;  // почему-то в имени в конце стоит \n
    buf[i] = 0;
    string vs(buf);
    ss << "FFR_GetVesselInfo returned ind "<<vesselIndex <<" :centerLineCount="<<*centerLineCount;
    ss << " bifurcationsCount="<<*bifurcationsCount <<" vesselName="<<vs;
    tracer.log(ss.str());
}

void t_FFR_GetVesselBifurcations(FFRProcessor*, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount) {
    stringstream ss; ss << "FFR_GetVesselBifurcations(FFR,vesselIndex="<<vesselIndex<<",dest[],count="<<bufferCount<<")";
    tracer.log(ss.str());
}
void t_FFR_GetVesselBifurcations_fin(FFRProcessor*, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount) {
    stringstream ss; ss << "FFR_GetVesselBifurcations_fin(FFR,vesselIndex="<<vesselIndex<<",dest[],count="<<bufferCount<<")";
    ss << "\n "<<points_to_string(dest,bufferCount,"dest[]",5);
    tracer.log(ss.str());
}
void t_FFR_GetVesselCenterLine(FFRProcessor* , int vesselIndex, mvox::Point3D_Double* dest, int bufferCount) {
    stringstream ss; ss << "t_FFR_GetVesselCenterLine(FFR,vesselIndex="<<vesselIndex<<",dest[],count="<<bufferCount<<")";
    tracer.log(ss.str());
}
void t_FFR_GetVesselCenterLine_fin(FFRProcessor*, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount) {
    stringstream ss; ss << "t_FFR_GetVesselCenterLine_fin(FFR,vesselIndex="<<vesselIndex<<",dest[],count="<<bufferCount<<")";
    ss << "\n "<<points_to_string(dest,bufferCount,"dest[]",5);
    tracer.log(ss.str());
}

void t_FFR_PrepareResult(FFRProcessor* , FFRStenosis* stenosis, int stenosisCount) {
    stringstream ss; ss << "FFR_PrepareResult(FFR,,stenosisCount="<<stenosisCount<<")";
    tracer.log(ss.str());
    if(stenosisCount == 0) return;
    mvox::Point3D_Double p; double a;
    ss << "FFRStenosis={id="<< stenosis[0].Id<<",type="<<stenosis[0].StenosisType<<",UserStenosisPercent"<<stenosis[0].UserStenosisPercent<<"..\n ";
    p = stenosis[0].Center.Position; a = stenosis[0].Center.Area;
    ss << "Center={("<<p.x<<","<<p.y<<","<<p.z<<") area="<<a<<")\n";
    p = stenosis[0].Front.Position; a = stenosis[0].Front.Area;
    ss << "Front={("<<p.x<<","<<p.y<<","<<p.z<<") area="<<a<<")\n";
    p = stenosis[0].Rear.Position; a = stenosis[0].Rear.Area;
    ss << "Rear={("<<p.x<<","<<p.y<<","<<p.z<<") area="<<a<<")\n";
    tracer.log(ss.str());
}



void mywriter(wchar_t* text) {
    tracer.log("mywriter called");
    wstring wtext = text; char buf[1024*10]; int maxlen = sizeof(buf)-1,i;
    for(i=0; i<wtext.size() && i<maxlen; i++)
        buf[i] = (char)text[i];    // вот не нашел другого способа работать с wstring
    buf[i] = 0;
    string vs(buf);
    ofstream o;
    o.open("./FFR/input_data.tre");
    o << vs;
    o.close();

//    tracer.log(vs);
}
