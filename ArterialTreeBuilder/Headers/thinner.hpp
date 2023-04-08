#ifndef THINNER_HPP
#define THINNER_HPP

#include <vector>
#include <set>
#include "utils.h"

using namespace std;

/** \brief This class inputs segmentation and outputs corresponding 1D graph.
 *  1D graph contains inforamtion about network topology, lenghs and mean
 *  radii for every vessel segment.
 *
 * Class Thinner is used by class VTB for thinning and graph building for
 * input segmentation. Graph building consists of three steps:
 * skeletonization, false twigs elimination, and graph reconstruction.
 * Current realization of skeletonization algorithm is a
 * variant of Chris Pudney's Distance Ordered Homotopic Thinning. 
 * False twigs elimination is an algorithm which removes all skeletal
 * segments, that do not correspond to actual arteries.
 * Graph reconstruction algorithm destructs skeleton into skeletal segments
 * and voxel-nodes, construct corresponding graph edges and nodes, then
 * reorderes it according direction of bloodflow.
 * \todo(cites)
 */


/*
struct FreneFrame{
  double t[3];
  double n[3];
  double b[3];
};*/

class Thinner
{
  public:
    vector<vector<int> > N26;
    vector<vector<int> > N18;
    vector<vector<int> > N6;

    unsigned long long dim[3];
    unsigned long long n;

    unsigned maxNoiseLength;
    double vsize[3];
    int* dmap;
    int* Z;
    vector<vector<int> > Foreground;
    vector<vector<int> > Border;

    // for tree building
    long long leftOstiaID, rightOstiaID;
    long long leftThinnerOstiaInd, rightThinnerOstiaInd;
    unsigned graphNodesCount;
    
    vector<vector<int> > VoxelNodes;
    vector<vector<vector<int> > > SkeletalSegments;
    
    vector<vector<Utils::FreneFrame > > FreneFrames;
  public:
    Thinner(short* _Z, unsigned long long *_dim, double *vsize_);
    ~Thinner();

    void getN26();
    void getN18();
    void getN6();
    unsigned long long getIndex (unsigned x, unsigned y, unsigned z);
    void getCoords(unsigned outputCoords[3], unsigned long long index);
    
    void initForeground();
    void findBorder();
    int D(vector<int> p1,vector<int> p2);
    int d(vector<int> point);

    void mainAlgorithm();
    void distanceTransform();
    unsigned max_dmap_val;

    bool isEndPoint (vector<int> point);
    bool isEdgePoint (vector<int> point, int threshold);
    bool isCenterOfMaxBall (vector<int> point, int threshold);

    bool adjacentToComponent (vector<int> p, set<vector<int> > component, int adj);
    double findRadius (vector<int> point, bool vsize_on);
    bool isSimple (vector<int> point);
    void removeBorderCycles();
    void Thinning1 (int threshold);
    int Thinning2 (vector<vector<int> > SetForThinning);

    // for tree building
    void findVoxelNodes();
    void destructToSegments();
    double getSegmentLength(vector<vector<int> > segment, int step);
    double eNorm3(vector<int> A,vector<int> B);
    void removeShortSegments(unsigned threshold);
    void printSkeletonOnTxt(char * session);
public:
  // structured graph methods
 
  int leftOstiaNodeID, rightOstiaNodeID;
  int leftOstiaRibID, rightOstiaRibID;
  
  void getFreneFramesAlongTheBranches();
  void outputFreneFrames(vector<vector<vector <double > > > result);
  void newBuildTree(unsigned threshold);
  
  int getVoxelNodeComponentID(int x, int y, int z);
  // stenoses members and methods
  
  //EXPERIMENTAL
public:
  //void removeGaps();
  //void removeGap();
  //void removeGap2();
};

#endif /*THINNER_HPP*/