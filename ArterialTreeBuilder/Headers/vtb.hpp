#ifndef VTB_HPP
#define VTB_HPP

#include "idt.hpp"
#include "thinner.hpp"
#include "graph.h"
#include "utils.h"

using namespace std;

/// Structure that contains input parameters for every program run
struct VTBParameters {
	char sessionName[80]; ///< Session name 
	char dirName[80]; ///< Path of directory with DICOM data set
	double idtStopParameter; ///< Stop parameter for IDT
	int aortaThreshold; ///< Intensity threshold for segmentation of initial mask of IDT
	unsigned maxNoiseLength; ///< Maximum length of false twig
	double frangiThreshold; ///< Thresholding parameter for Frangi Vesselness
	unsigned minDistBetweenOstia; ///< Minimum distance between ostia points of coronary arteries
	unsigned minNumOfVoxelsInBranch;
	double frangi_alpha;
	double frangi_beta;
	double frangi_c;
	unsigned ostiumSearchThickness;
};


/** \brief Ruling class, that conducts all the work of other mudules.
 *
 *  Class VTB organizes work of classes IDT, VesselTracker, Thinner
 *  and Frangi Vesselness module for segmentation of vessels and graph building depending
 *  on anatomical region. VTB uses IDT class as the base of aorta
 *  segmentation algorithms in cases of coronary and cerebral arteries
 *  segmentation. Class Thinner is used by VTB for graph building for
 *  input segmentation. Class VesselTracker is used for fast centerlines
 *  extraction in case of leg arteries.
 */
class VTB {
public:
	// common terms
	VTBParameters* parameters; ///< input parameters for every program run

public:
	void loadManualSegmentation(std::string left_filename, std::string right_filename, double* left_ostium, double* right_ostium);
	void updateAortaCut(double tau);
	IDT* idt; ///< IDT class instance 
	Thinner* thinner; ///< Thinner class instance
	Graph* graph;

	double vsize[3]; ///< Spacing of input image, size of voxel
	unsigned long long dim[3]; ///< Dimentions of input image
	unsigned long long n; ///< Number of voxels in input image
	double origin[3]; ///< Origin of DICOM dataset
	double transformMatrix[9];

	double aortaRadiusOnFirstSlice;
	int aortaCenterOnSlice;
	unsigned long long aortaInitialPointIndex;
	unsigned long long aortaCenterOnFirstSlice[3];
	short aortaMaskThresholdValue;

	short* Image;
	Utils::AGBImage3D * Image3D;

	double* Vesselness;

	bool* aortaMask;
	bool* nearAortaMask;
	bool* vesselnessCutMask;
	short* nonvesselnessMask;

	// terms for coronary arteries
public:
	bool reversedX, reversedY;
	long long leftOstia, rightOstia, ostia1, ostia2;
	short* vesselComponents;
	/* vesselComponents -- замена для масок leftBranchMask, rightBranchMask и userBranchMask
						  * левой ветвь - маркер 1, правая ветвь - маркер 2
						  * установленные юзером ветви будут нумероваться от 3 и выше*/

	vector <vector <unsigned long long > > userMarkedVessels;
	int userSeedPointsCount;
	vector <vector<int> > userSeedPoints;
	void regrowUserSeeds();

public:
	void InitializeThinner();
	void InitializeGraph();
public:
	void initializeNonvesselnessMask(short threshold, float kernelSize);
	VTB();
	~VTB();
	void initializeImageWithPulmonaryRemoval(short* data,
											unsigned long long in_dim0,
											unsigned long long in_dim1,
											unsigned long long in_dim2,
											float scaleX,
											float scaleY,
											float scaleZ,
											unsigned long long aorta_index);
	unsigned long long getIndex(unsigned x, unsigned y, unsigned z);
private:
	// common methods
	void tempFunction();
	void initializeVTBParameters();

	void removeIslands(short* labels, unsigned long long comp_threshold);
	int regionGrowing(const unsigned long long seed, bool* mask);
	int regionGrowing(const unsigned long long seed, int marker);
	int regionGrowingInImage(const unsigned long long seed, bool* mask, int thold);
	void regionGrowing2(unsigned short* mask,
						  unsigned long long seed,
						  unsigned rule_value,
						  unsigned val,
						  bool only_result_matter);

	void printMaskOnTxt(char* maskType, bool* mask);
	void WriteBorderOnTxt(unsigned short* map, char* name);


	// methods for coronary arterias
public:
	bool findAortaInitializeParameters(unsigned long long sliceIndex);
	void preprocessAorta();
	void preprocessCoronaryArteries();
	void preprocessVesselness();

	void extractCoronaryVessels();
	void smoothMask(unsigned sizeShrink, unsigned sizeExpand, bool* mask);
	void smoothMask(unsigned sizeShrink, unsigned sizeExpand, short* mask);
private:
	void getDistanceMap(bool* _mask, unsigned* distanceMap, bool rule);
	void getDistanceMap(short* _mask, unsigned* distanceMap, bool rule);

	void findFirstOstiaPoint();
	void findSecondOstiaPoint();
	void findOstiaPoints();
	void removeNearAortaVesselLeaks(unsigned* dmap, bool* vesselMask, unsigned layers_size);
	void removeNearAortaVesselLeaks(unsigned* dmap, unsigned layers_size);
	void findOstiaPointsViaLeaks();

public:

	//unsigned long long correctOstiaPoint(bool * branchMask);
    unsigned long long correctOstiaPoint(const char* mode);

	void addUserVessel(unsigned long long seed);
	void popUserVessel();

	int manualVesselsCount;


	// EXPERIMENTAL
	double meanAorta;
	double deviationAorta;
	void findMeanAndDeviationInAorta();
	double getWeightFunction(short intensity);
	double functionToArgMin2D(short* crossSection, unsigned crossSize, double spacing,
							   vector<unsigned long> centralComponent,
							   double a, double b);
	void takeCrossSection(vector<int> point, vector<vector<double> > freneFrame, short* slice, bool* sliceMask, unsigned N);
	double threeLineInterpolation(double point[3]);
	int checkSegmentationAtPoint(double point[3]);
	void getCentralCrossectionComponent(int sliceSize, bool* sliceMask, vector<unsigned long> component, bool* marked);
	/*
	vector<unsigned long long> sphereRegionGrowing(unsigned long long seed, double diam, bool* temp_mask);

	private:
		double sqrdDist(unsigned long long ind1, unsigned long long ind2);
		vector <unsigned long long> getVesselCenterline();
		*/
public:
	void findCenterlineMeanIntensitiesAround(vector <vector<int> >& cnt);
	void printMaskOnMHD(string fileNamePrefix, short* mask);


	void getCrossSection(short* crossSection, int halfSize,
						 vector<double> oX,vector<double> oY,
						 vector<double> sliceOrigin,
						 double spacing[2],
						 string mode);
	void getComissuralArcs(double p1[3], double p2[3], double p[3]);

};

#endif /*VTB_HPP*/
