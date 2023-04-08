// ======================================================================
// Class of Isoperimetric Distance Trees performed in paper
// "Fast, Qualitu,Segmentation of Large Volumes -
//     	Isoperimetric Distance Trees" by Leo Grady
//
// Distance Map building performed in paper
// "Sequental Operations in Digital Picture Processing"
// by A.Rosenfeld and Pfaltz
// ======================================================================

#ifndef IDT_HPP
#define IDT_HPP
//#include <vtkSmartPointer.h>
//#include <vtkDICOMImageReader.h>
//#include <vtkImageData.h>
//#include <vtkShortArray.h>
//#include <vtkPointData.h>

using namespace std;
class IDT
{
  private:

  public:
    short *Image;
    const char *dir_name;
    double thold, ratio_thold;
    double optimal_tau = -1.0; // default value is negative
    int k,l,m; // shape of Image
    double vsize[3];
    int n;    // n = k*l*m
    bool* mask;
    bool* resulting_mask;
    unsigned* distanceMap;
    int num_of_nodes;
    int num_of_edges;
    int tree_root;      // index of Nodes array
    int ground_node;    // index of Nodes array
    int background_node;// index of Nodes array
    double volume;	// x*r = volume of whole mask
                        // where r -- vector of all units

    int* Nodes;			// int[num_of_nodes]]
    int* Weights;		// int[6*num_of_nodes]	non diagonal Laplacian elements
    char* Diagonal;		// int[num_of_nodes]	diagonal Laplacian elements
    int* Edges;			// int[6*num_of_nodes]	endpoint of edges
    vector<pair<int,int> > TreeEdges;	// set of tree edges
	

    int* tree; 		// contains one neighbour for each node 
    int* degree;		// degrees of tree nodes
    int* ordering;		// ordering of tree nodes;
//    long double* solution;	// real valued solution
	int * solutionOrder; 
    bool* partition;		// ratio cut partition
  public:
	  long double* solution;	// real valued solution
	  IDT (const char * _dir_name,
         const double _thold,
         const double _ratio_thold,
         const int ground,
         const int background,
		 const int seed);
	IDT (short * CubeData,
		 const double _thold,
         const double _ratio_thold,
         const int ground,
		 unsigned long long * dim,
		 double * _vsize,
         const int seed);
	
    ~IDT();
	double mainAlgorithm(const int ground, const int background);
	void sortNodesBySolution();
    void getPartitionByPercent(double percent);
    //void ParseDicomImage ();
    int atFace0 (const int i);
    int atFace1 (const int i);
    int atFace2 (const int i);
    int atFace3 (const int i);
    int atFace4 (const int i);
    int atFace5 (const int i);

    void getMask (const int seed);
    void getNodes (const int ground,
                   const int background);
    void getDistanceMap (bool * _mask, bool rule);
    void getWeights();
    void getEdges();

    void IndependantPrimMethod();
    void PrimMethod();
    void getOrdering();
    void solveSystem();
    double getRatioCut();
    void removeVessels(unsigned size);
};

#endif /*IDT_HPP*/