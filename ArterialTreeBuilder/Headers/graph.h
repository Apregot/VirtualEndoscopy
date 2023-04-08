#ifndef GRAPH_HPP
#define GRAPH_HPP

#include <vector>
#include "thinner.hpp"

using namespace std;
enum vesselType
{
  REGULAR = 0,
  STENOSIS = 1,
  STENT = 2,
  FLOW3D = 3,
  GAP = 4
};

enum BranchType
{
  UNADOPTED = 0,
  LEFT = 1,
  RIGHT = 2
};

struct GraphRib
{
  int reorderedID;
  int ID;
  int firstEndID;
  int secondEndID;
  int markerPointID;
  int markerExtraPointID;
  double stenosisPersent=0;
  double diameterCM=0;
  int parentRib=-2;
  int childRib=-1;
  vector <vector<int> > points;
  vesselType marker;
  BranchType branchLabel;
  bool isGapRib=0;
  int labelID; // для того чтобы перемещаться по Rigth/Left/UnadoptedRibs
  bool selected; // если компонента графа, в которой содержится вершина, выбрана
};

struct GraphNode
{
  //TODO нужно ли добавлять список точек
  int reorderedID;
  int ID;
  vector <int> incidentRibsID;
  double x;
  double y;
  double z;
  int degree;
  BranchType branchLabel;
  int labelID; // для того чтобы перемещаться по Rigth/Left/UnadoptedNodes
  bool selected; // если компонента графа, в которой содержится вершина, выбрана
  vector<vector <int> > voxelNodes;
  bool isNullNode=0;
};

class Graph {
  Thinner *thinner;
public:
  int leftOstiaNodeID, rightOstiaNodeID;
  int leftOstiaRibID, rightOstiaRibID;
  
  unsigned finalGraphRibsCount;
  unsigned finalGraphNodesCount;

  vector<GraphRib> Ribs;
  vector<GraphNode> Nodes;
  // use these graph to reaload initial graph
  vector <GraphRib> initialRibs;
  vector <GraphNode> initialNodes;

  vector <int> terminalPathLabels;

  vector<vector<vector<int> > > TerminalPaths;
  int numOfTerminalPaths;
  int numOfLeftTerminalPaths;
  vector<vector<vector<int> > > NodesOnTerminalPaths;

  vector <int> LeftRibs, RightRibs, UnadoptedRibs, SelectedComponentRibs;
  vector <int> LeftNodes, RightNodes, UnadoptedNodes, SelectedComponentNodes;

  Graph(Thinner *thinner);
  ~Graph();

  void glueRibsToTerminalPaths();
  void returnRibsAsTerminalPaths();
  void wrapGraph();
  void redefineWrappers();
  void reloadGraph();

  vector <vector <int>> StenosisPaths;
  bool locateWholeStenosis (int stenosisID, int begin[3], int end[3], int type, double stenosisPersent);

  void fillParentRibs();
  void fillChildrenRibs();
  double meanDiameterOnChildSegment(unsigned ribID, unsigned numOfVoxels);
  double meanDiameterOnParentSegment(unsigned ribID, unsigned numOfVoxels);
  int findChild(unsigned ribID);
private:
	
  bool locateStenosisEnds(int front[3], int end[3], int segmentsID[2]);
  bool isNearEndOfSegment(unsigned pointID, int segmentID, int nodeID);
  
  void findVoxelNodesConnectiveComponents();
public:
  void findOstiaNodesAndRibs();
  int findGraphNodeBetweenRibs(unsigned segment1, unsigned segment2);
private:
  void cutRibAtPoint (int ribID, unsigned pointID, int stenosisDirection);
  
  //Printing methods
public:
  void printNode(ofstream &output, GraphNode node);
  void printRib(ofstream &output, GraphRib rib, bool printPoints);

  void printGraph(ofstream &output);
  void printGraphOnGV(string output);
  void removeGaps();

private:
	void pushRibs(vector<vector<double> > oldConnections);
	void pushNodes(vector<vector<double> > oldConnections, vector<vector<double> > newConnections);
	double metric(vector<double> p1, vector<double> p2);
	void addLineRib(GraphNode& nodeAdopted, GraphNode& nodeUnadopted);
	void addLineRib(GraphRib& rib, const int pointID, GraphNode& nodeUnadopted);
// HARDCODE
private:
	void removeGap3();
// remove gaps for heartFlow datasets
public:
	void removeGaps_HFD1P2();
	void fillDiameters ();
private:
// experimental
	void selectGraphComponent(unsigned ribNo);
	unsigned getNearestAdoptedNode(double p[3], double &minDistSqrd_out);
	//unsigned getNearestAdoptedRibPoint(double p[3], unsigned &ribPointID, double &dist);
	unsigned getNearestAdoptedRibPoint(int nodeID, unsigned &ribPointID, double &penalty);
	int numOfRibsToOstium(unsigned ribID, int & parentRibID);
	double getDirectionWeights(int unodoptedNodeID, int adoptedRibID, int adoptedRibPointID, double *outputWeights);

	vector<GraphRib> RemovedRibStack, RedoRibStack;
	vector<pair<GraphNode,GraphNode> > RemovedNodeStack, RedoNodeStack;
	vector<vector<GraphRib> > GapRibsStack;
	vector<vector<GraphNode> > GapNodesStack;
	
	void RemoveRibs(vector <int> ribIndices);
public:
	void RedoRemoveRib();
	void UndoRemoveRib();

	void UndoRemoveGaps();

	void clearRedoStack();
	void RemoveRib(int ribID, ofstream &o);
	bool LastRedoRibIsTerminal();
	bool LastRemovedRibIsTerminal();
	bool checkVoxelNodesUpToDate();
private:
	GraphNode nullNode;

	void getRibDirectionAtPoint(int ribID, int pointID, double *direction);
	void getParentRibDirection(int ribID, int pointID, double *direction);
	
	int getRibOrientation(int ribID);
};
#endif //GRAPH_HPP