#ifndef TRACER_H
#define TRACER_H
#include <string>
#include <map>
#include <utility>  // std::pair
#include "mvox.h"
#include <string.h> // memset

using namespace std;

struct MSec {       // текущая секунда и милисекунда
    time_t          sec;
    unsigned int    msec;
};

class Tracer
{
public:
	Tracer();
	Tracer(std::string tracefile);
	~Tracer();
	void log(std::string str, std::string terminationString="\n");
	void logInt(std::string name, int val);
	static MSec msec(); //текущая секунда и милисекунда
	void startInterval(string label);
	void stopInterval(string label);
	double getInterval(string label);
	void   logInterval(string label);

private:
	std::string tracefile;
	time_t s0, s1;
	map<string,pair<MSec,MSec>> intervals;  // string -> pair<MSec,MSec>    начало конец интервала
};

extern Tracer tracer;
extern void cube_test_1(mvox::Cube cube);
extern void write_cube(mvox::Cube cube, string filename);
extern bool read_cube(mvox::Cube & cube, string filename);
// Hard assert - утверждение, которое должно жестко выполняться
#define hassert(expression) (void)(  (!!(expression)) || (tracer.log(std::string("hard assert failed: ")+#expression), tracer.log("exiting.."), exit(1), true) )
//#define hassert(expression) (void)(  (!!(expression)) || tracer.log(#expression) )

// интефейс с FFR DLL
class FFRProcessor;
extern bool AortaSearch_FindAorta(mvox::Cube sourceCube, mvox::Point3D_Double* point, double* radius);
extern FFRProcessor *FFR_Initialize(FFRSettings settings);
extern void FFR_Process_PrepareAortaProc(FFRProcessor* processor, mvox::Cube sourceCube, mvox::UpdateProgress progressFunction);
extern double FFR_GetOptimalTau(FFRProcessor* processor);
extern void FFR_Process_LoadAortaPreview(FFRProcessor* processor, mvox::Cube segmCube, uint8_t targetCode, double tau);
extern void FFR_Process_PrepareVesselsProc(FFRProcessor* processor,mvox::Cube sourceCube,mvox::UpdateProgress progressFunction,VesselsSegmParameters vesselsSegmParameters);
extern void FFR_Process_SetVesselsSeeds(FFRProcessor* processor, mvox::Point3D_Double* seedPoints, int count);
extern void FFR_Process_LoadVesselsPreview(FFRProcessor* processor,mvox::Cube segmCube,unsigned char targetCode,double threshold);
extern int  FFR_Process(FFRProcessor* processor,mvox::Cube sourceCube,mvox::UpdateProgress progressFunction,CompleteParameters completeParameters);
extern void FFR_LoadAortaObject(FFRProcessor* processor,mvox::Cube segmCube,uint8_t targetCode);
int  FFR_GetVesselsObjectsCount(FFRProcessor* processor);
extern void FFR_LoadVesselsObject(FFRProcessor* processor,mvox::Cube segmCube,uint8_t targetCode,int vesselObjectIndex);
extern int  FFR_GetVesselsCount(FFRProcessor* processor);
extern void FFR_GetVesselInfo(FFRProcessor* processor, int vesselIndex, int* centerLineCount, int* bifurcationsCount, wchar_t* name);
extern void t_FFR_GetVesselInfo_fin(FFRProcessor* , int vesselIndex, int* centerLineCount, int* bifurcationsCount, wchar_t* name);
extern void FFR_GetVesselBifurcations(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount);
extern void FFR_GetVesselCenterLine(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount);
typedef void(*FFRTextWriter)(wchar_t* text);
extern void FFR_PrepareResult(FFRProcessor* processor, FFRStenosis* stenosis, int stenosisCount,FFRTextWriter writer);
extern void mywriter(wchar_t* text);
extern int FFR_DeleteVessel(FFRProcessor* processor, int vesselIndex);

/*
 * Вспомогательные функции трассировки. Вызываются в прологе и иногда эпилоге функций FFR_*
 *
 */
class FFRProcessor;
class VTB;
struct FFRStenosis;
void t_AortaSearch_FindAorta(mvox::Cube sourceCube);
	struct AortaSearch_FindAorta_stat {
		int dims[3];        // размерность куба
		double zrange[2];   // Z-диапазон кубика
		int dir[2];         // slice ind from to
		int sliceIndex;     // индекс кадра, в котором будет искаться срез аорты
		int dark;           // счетчики темных и светлых пикселей; темный - slice[0][0]
		int white;
		bool result;        // найден ли срез аорты
		double point[3];    // найденный центр и радиус среза аорты, если result = true
		double radius;
		int IJ[2];          // центр и радиус откружности в координатах IJK
		double rad;
		float avgHU;
	};
void t_AortaSearch_FindAorta_fin(mvox::Cube sourceCube, double* circles, int n);
void t_FFR_Initialize(FFRSettings settings);
void t_FFR_Process_PrepareAortaProc(FFRProcessor* processor, mvox::Cube sourceCube, mvox::UpdateProgress progressFunction);
void t_FFR_Process_PrepareAortaProc_fin(mvox::Cube sourceCube);
void t_FFR_GetOptimalTau(FFRProcessor* processor);
void t_FFR_Process_LoadAortaPreview(FFRProcessor* processor, mvox::Cube segmCube, uint8_t targetCode, double tau);
void t_FFR_Process_LoadAortaPreview_fin(mvox::Cube segmCube, uint8_t targetCode);
void t_FFR_Process_PrepareVesselsProc(FFRProcessor* processor,mvox::Cube sourceCube,mvox::UpdateProgress progressFunction,VesselsSegmParameters vesselsSegmParameters);
void t_FFR_Process_PrepareVesselsProc_fin(mvox::Cube cube, bool *aortaMask, bool *nearAortaMask);
void t_FFR_Process_SetVesselsSeeds(FFRProcessor* processor, mvox::Point3D_Double* seedPoints, int count);
void t_FFR_Process_LoadVesselsPreview(FFRProcessor* processor,mvox::Cube segmCube,unsigned char targetCode,double threshold, VTB *vtb);
void t_FFR_Process_LoadVesselsPreview_fin(FFRProcessor*,mvox::Cube cube,unsigned char targetCode, VTB *vtb);
void t_FFR_Process(FFRProcessor* processor,mvox::Cube sourceCube,mvox::UpdateProgress progressFunction,CompleteParameters completeParameters, VTB *vtb);
void t_FFR_Process_trace(VTB *vtb);
void t_FFR_Process_assert_1(VTB *vtb);
void t_FFR_Process_assert_2(VTB *vtb);
void t_FFR_Process_fin(int cursor);
void t_FFR_LoadAortaObject(FFRProcessor* processor,mvox::Cube segmCube,uint8_t targetCode);
void t_FFR_LoadAortaObject_fin(mvox::Cube segmCube,uint8_t targetCode);
void t_FFR_GetVesselsObjectsCount(FFRProcessor* processor);
void t_FFR_LoadVesselsObject(FFRProcessor* processor,mvox::Cube segmCube,uint8_t targetCode,int vesselObjectIndex);
void t_FFR_LoadVesselsObject_fin(mvox::Cube segmCube,uint8_t targetCode,int vesselObjectIndex);
void t_FFR_GetVesselsCount(FFRProcessor* processor);
void t_FFR_GetVesselInfo(FFRProcessor* , int vesselIndex, int* centerLineCount, int* bifurcationsCount, wchar_t* name);
void t_FFR_GetVesselInfo_fin(FFRProcessor* , int vesselIndex, int* centerLineCount, int* bifurcationsCount, wchar_t* name);
void t_FFR_GetVesselBifurcations(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount);
void t_FFR_GetVesselBifurcations_fin(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount);
void t_FFR_GetVesselCenterLine(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount);
void t_FFR_GetVesselCenterLine_fin(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double* dest, int bufferCount);
void t_FFR_PrepareResult(FFRProcessor* processor, FFRStenosis* stenosis, int stenosisCount);
//===============================================================================

#endif // TRACER_H
