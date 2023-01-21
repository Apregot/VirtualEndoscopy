#include "stdafx.h"
#include "graph.h"
#include "thinner.hpp"

/*Алгоритм:
1) находим компоненты связности вокселей-вершин и нумеруем их
2) заполняем ребра и вершины графа
3) находим правые и левые ребра и вершины устья
4) находим и размечаем branchLabel левой и правой ветвей
5) устраняем разрывы -- (нужно разработать алгоритм!)
6) измельчаем граф метками стенозов
7) упорядочиваем ветви графа с помощью враперов ???? (придумать нужны ли вообще враперы и как их использовать)
*/

#include <string>
#include "configuration.h"


Graph::Graph(Thinner* thinner) : thinner(thinner) {
	assert(thinner->SkeletalSegments.size() > 0);

	numOfTerminalPaths = 0;
	numOfLeftTerminalPaths = 0;
	rightOstiaRibID = leftOstiaRibID = -1;
	//rightOstiaRibID=leftOstiaRibID=-1;

	findVoxelNodesConnectiveComponents();
	GraphRib rib;
	GraphNode node;

	Ribs.clear();
	vector<vector<int> > NodesSegmentsIncidence(Nodes.size());

	for (unsigned i = 0; i < thinner->SkeletalSegments.size(); ++i) {
		auto end = *(thinner->SkeletalSegments[i].begin());
		rib.firstEndID = thinner->getVoxelNodeComponentID(end[0], end[1], end[2]);
		end = *(thinner->SkeletalSegments[i].end() - 1);
		rib.secondEndID = thinner->getVoxelNodeComponentID(end[0], end[1], end[2]);
		rib.ID = i;
		rib.marker = REGULAR;
		rib.points = thinner->SkeletalSegments[i];
		rib.reorderedID = -1;
		rib.markerExtraPointID = -1;
		rib.branchLabel = UNADOPTED;
		rib.stenosisPersent = 0.;
		Ribs.push_back(rib);
		//initialGraphRibs.push_back(rib);

		NodesSegmentsIncidence[rib.firstEndID].push_back(i);
		NodesSegmentsIncidence[rib.secondEndID].push_back(i);
	}
	for (unsigned i = 0; i < Nodes.size(); ++i) {
		Nodes[i].ID = i;
		Nodes[i].reorderedID = -1;
		Nodes[i].selected = 0;
		Nodes[i].branchLabel = UNADOPTED;
		Nodes[i].incidentRibsID = NodesSegmentsIncidence[i];
		Nodes[i].degree = NodesSegmentsIncidence[i].size();
	}



	/*
	vector<int> ribsToRemove = { 0, 4, //right branch veins
		//12, //right branch noise near RCA
		38, //right branch noise near ostium,
		42, //left branch noise near ostium,
		10,23, //left branch noise near LAD,
		//37,16, //left branch connections to veins,
		34,29,44,17,11,27,28 // left branch veins
	  };*/

	  // vector<int> ribsToRemove = {30,33,25,23,11,24,0,4,34,38,12,19,9};

	vector<int> ribsToRemove;
	ifstream ribsToRemoveStream;
	ribsToRemoveStream.open("REMOVE_VEINAL_RIBS.rmvr");
	if (ribsToRemoveStream.is_open()) {
		int a;
		while (ribsToRemoveStream >> a)
			ribsToRemove.push_back(a);
		ribsToRemoveStream.close();
		if (ribsToRemove.size() > 0)
			RemoveRibs(ribsToRemove);
	}
	findOstiaNodesAndRibs();
	ofstream o;
	o.open("log_graph_main_alg.txt");
	o << leftOstiaNodeID << " " << rightOstiaNodeID << endl;

	wrapGraph();
	printGraph(o);
	o << "GRAPH PRINTED\n";
	/*
	{ // для пациента Степкина ЕП
		removeGap3();
		wrapGraph();
	}*/
	{ // для hearflow data 1disk pat2
		o << "REMOVING GAPS\n";
		removeGaps_HFD1P2();
		o << "PRINTING GRAPH\n";
		printGraph(o);
		o << "WRAPPING GRAPH\n";
		wrapGraph();
		o << "DONE\n";
	}
	o.close();

	initialNodes = Nodes;
	initialRibs = Ribs;

	nullNode = GraphNode();
	nullNode.isNullNode = 1;
	nullNode.branchLabel = UNADOPTED;
	nullNode.degree = -1;
	nullNode.ID = -1;
	nullNode.incidentRibsID.clear();
	nullNode.labelID = -1;
	nullNode.reorderedID = -1;
	nullNode.selected = 0;
	nullNode.x = 0;
	nullNode.y = 0;
	nullNode.z = 0;
}

Graph::~Graph(void) {
	Nodes.clear();
	Ribs.clear();
	LeftNodes.clear();
	RightNodes.clear();
	UnadoptedNodes.clear();
	SelectedComponentNodes.clear();

	LeftRibs.clear();
	RightRibs.clear();
	UnadoptedRibs.clear();
	SelectedComponentRibs.clear();

	terminalPathLabels.clear();

	StenosisPaths.clear();

	RemovedNodeStack.clear();
	RemovedRibStack.clear();
	RedoNodeStack.clear();
	RedoRibStack.clear();

	GapRibsStack.clear();
	GapNodesStack.clear();
}


void Graph::redefineWrappers() {
	LeftNodes.clear();
	LeftRibs.clear();
	RightNodes.clear();
	RightRibs.clear();
}
void Graph::RedoRemoveRib() {
	assert(RedoRibStack.size() > 0);
	int ribToRemoveID = (RedoRibStack.end() - 1)->ID;
	RedoRibStack.erase(RedoRibStack.end() - 1);

	ofstream o;
	RemoveRib(ribToRemoveID, o);
	wrapGraph();
}

void Graph::clearRedoStack() {
	RedoRibStack.clear();
}


void Graph::printGraphOnGV(string output) {
	findOstiaNodesAndRibs();
	wrapGraph();

	ofstream graphGV;
	graphGV.open("graph" + output + ".gv");
	graphGV << "graph coronaryTree {\n#graph[dpi=300];\n";

	ofstream ffrout;
	ffrout.open(".\\FFR\\input_data.tre");
	wostringstream ws;

	int allRibsCount = Ribs.size();
	int allNodesCount = Nodes.size();



	double vsize_cm[3];

	vsize_cm[0] = .1 * thinner->vsize[0];
	vsize_cm[1] = .1 * thinner->vsize[1];
	vsize_cm[2] = .1 * thinner->vsize[2];

	// узлы левой ветви
	if (LeftNodes.size() > 0) {
		// число узлов

		for (int i = 0; i < LeftNodes.size(); ++i) {
			auto node = Nodes[LeftNodes[i]];
			// knot number \n
			if (i == 0)
				graphGV << "L_" << i + 1 << "_" << node.ID << " [color=red, shape=box, xlabel=\"Z[]-4 = " << thinner->getVoxelNodeComponentID(node.voxelNodes[0][0], node.voxelNodes[0][1], node.voxelNodes[0][2]) << "\"];\n";
			else
				graphGV << "L_" << i + 1 << "_" << node.ID << " [color=red, xlabel=\"Z[]-4 = " << thinner->getVoxelNodeComponentID(node.voxelNodes[0][0], node.voxelNodes[0][1], node.voxelNodes[0][2]) << "\"];\n";
		}
	}

	// узлы правой ветви
	if (RightNodes.size() > 0) {
		for (int i = 0; i < RightNodes.size(); ++i) {
			auto node = Nodes[RightNodes[i]];
			if (i == 0)
				graphGV << "R_" << i + 1 << "_" << node.ID << " [color=blue, shape=box, xlabel=\"Z[]-4 = " << thinner->getVoxelNodeComponentID(node.voxelNodes[0][0], node.voxelNodes[0][1], node.voxelNodes[0][2]) << "\"];\n";
			else
				graphGV << "R_" << i + 1 << "_" << node.ID << " [color=blue, xlabel=\"Z[]-4 = " << thinner->getVoxelNodeComponentID(node.voxelNodes[0][0], node.voxelNodes[0][1], node.voxelNodes[0][2]) << "\"];\n";
		}
	}
	if (RightNodes.size() + LeftNodes.size() < Nodes.size()) {
		for (auto it = Nodes.begin(); it != Nodes.end(); it++) {
			if (it->branchLabel == UNADOPTED)
				graphGV << "U_" << it->ID << "[color=gray, xlabel=\"Z[]-4 = " << thinner->getVoxelNodeComponentID(it->voxelNodes[0][0], it->voxelNodes[0][1], it->voxelNodes[0][2]) << "\"];\n";
		}
	}
	if (RightNodes.size() + LeftNodes.size() < Nodes.size()) {
		for (auto it = Ribs.begin(); it != Ribs.end(); it++) {
			if (it->branchLabel == UNADOPTED) {
				graphGV << "U_" << Nodes[it->firstEndID].ID
					<< " -- U_" << Nodes[it->secondEndID].ID
					<< " [color=red, label=\"" << it->ID;
				// segment length \n
				double segmentLength = 0.1 * thinner->getSegmentLength(it->points, 4);
				graphGV << "\\nlen = " << segmentLength << "cm";

				// segment average raduis \n
				double averageRadius = 0;
				for (auto j = 0; j < it->points.size(); ++j)
					averageRadius += 0.2 * thinner->findRadius(it->points[j], 1);
				averageRadius /= it->points.size();
				if (it->marker == STENOSIS)
					averageRadius *= (1.0 - it->stenosisPersent);
				graphGV << "\\ndiam = " << averageRadius << "cm\"";

				if (it->marker == 0) // regular vessel
					graphGV << "];\n";
				else if (it->marker == 1) // stenosis
					graphGV << "style=dashed];\n";
				else if (it->marker == 2) // stent
					graphGV << "style=bold];\n";
				else if (it->marker == 3) // flow 3D
					graphGV << "penwidth=7];\n";
			}
		}
	}

	// сегменты левой ветви

	if (LeftRibs.size() > 0) {
		for (int i = 0; i < LeftRibs.size(); ++i) {
			auto rib = Ribs[LeftRibs[i]];

			// start_node_index end_node_index \n
			int beginID = Nodes[rib.firstEndID].labelID + 1;
			int endID = Nodes[rib.secondEndID].labelID + 1;
			if (beginID > endID) {
				graphGV << "L_" << endID << "_" << Nodes[rib.secondEndID].ID
					<< " -- L_" << beginID << "_" << Nodes[rib.firstEndID].ID
					<< " [color=red, label=\"" << i + 1 << "_" << rib.ID;
			} else {
				graphGV << "L_" << beginID << "_" << Nodes[rib.firstEndID].ID
					<< " -- L_" << endID << "_" << Nodes[rib.secondEndID].ID
					<< " [color=red, label=\"" << i + 1 << "_" << rib.ID;
			}

			// segment length \n
			double segmentLength = 0.1 * thinner->getSegmentLength(rib.points, 4);
			graphGV << "\\nlen = " << segmentLength << "cm";

			// segment average raduis \n
			double averageRadius = 0;
			for (auto j = 0; j < rib.points.size(); ++j)
				averageRadius += 0.2 * thinner->findRadius(rib.points[j], 1);
			averageRadius /= rib.points.size();
			if (rib.marker == STENOSIS)
				averageRadius *= (1.0 - rib.stenosisPersent);

			graphGV << "\\ndiam = " << averageRadius << "cm\"";
			if (rib.marker == REGULAR) // regular vessel
				graphGV << "];\n";
			else if (rib.marker == STENOSIS) // stenosis
				graphGV << "style=dashed];\n";
			else if (rib.marker == STENT) // stent
				graphGV << "style=bold];\n";
			else if (rib.marker == FLOW3D) // flow 3D
				graphGV << "penwidth=7];\n";
		}
	}

	// сегменты правой ветви
	if (RightRibs.size() > 0) {
		for (int i = 0; i < RightRibs.size(); ++i) {

			auto rib = Ribs[RightRibs[i]];

			// start_node_index end_node_index \n
			int beginID = Nodes[rib.firstEndID].labelID + 1;
			int endID = Nodes[rib.secondEndID].labelID + 1;
			if (beginID > endID) {
				graphGV << "R_" << endID << "_" << Nodes[rib.secondEndID].ID
					<< " -- R_" << beginID << "_" << Nodes[rib.firstEndID].ID
					<< " [color=blue, label=\"" << i + 1 << "_" << rib.ID;
			} else {
				graphGV << "R_" << beginID << "_" << Nodes[rib.firstEndID].ID
					<< " -- R_" << endID << "_" << Nodes[rib.secondEndID].ID
					<< " [color=blue, label=\"" << i + 1 << "_" << rib.ID;
			}

			// segment length \n
			double segmentLength = 0.1 * thinner->getSegmentLength(rib.points, 4);
			graphGV << "\\nlen = " << segmentLength << "cm";

			// segment average raduis \n
			double averageRadius = 0;
			for (auto j = 0; j < rib.points.size(); ++j)
				averageRadius += 0.2 * thinner->findRadius(rib.points[j], 1);
			averageRadius /= rib.points.size();
			if (rib.marker == STENOSIS)
				averageRadius *= (1.0 - rib.stenosisPersent);
			graphGV << "\\ndiam = " << averageRadius << "cm\"";

			if (rib.marker == 0) // regular vessel
				graphGV << "];\n";
			else if (rib.marker == 1) // stenosis
				graphGV << "style=dashed];\n";
			else if (rib.marker == 2) // stent
				graphGV << "style=bold];\n";
			else if (rib.marker == 3) // flow 3D
				graphGV << "penwidth=7];\n";
		}
	}

	graphGV << "}\n";
	graphGV.close();

	graphGV.close();
}

void Graph::findVoxelNodesConnectiveComponents() {
	// marks every voxel node that belongs to a one connectivity component
	// by component_num = 4, ..., N+4;
	vector<int> node, coord(3);
	vector<float> gNode(3);
	vector<vector<int> > component;
	queue<vector<int> > front;
	int component_num = 4;

	Nodes.clear();
	thinner->findVoxelNodes();

	for (unsigned i = 0; i < thinner->VoxelNodes.size(); ++i) {
		if (thinner->Z[thinner->getIndex(thinner->VoxelNodes[i][0],
										 thinner->VoxelNodes[i][1],
										 thinner->VoxelNodes[i][2])] > 2)
			continue;
		component.clear();
		coord[0] = thinner->VoxelNodes[i][0];
		coord[1] = thinner->VoxelNodes[i][1];
		coord[2] = thinner->VoxelNodes[i][2];
		thinner->Z[thinner->getIndex(coord[0], coord[1], coord[2])] = component_num;
		front.push(coord);
		while (!front.empty()) {
			node = front.front();
			front.pop();
			component.push_back(node);
			for (int j = 0; j < 26; ++j) {
				coord = node;
				coord[0] += thinner->N26[j][0];
				coord[1] += thinner->N26[j][1];
				coord[2] += thinner->N26[j][2];
				if (thinner->Z[thinner->getIndex(coord[0], coord[1], coord[2])] == 2) {
					thinner->Z[thinner->getIndex(coord[0], coord[1], coord[2])] = component_num;
					front.push(coord);
				}
			}
		}
		gNode[0] = 0; gNode[1] = 0; gNode[2] = 0;
		for (unsigned k = 0; k < component.size(); ++k) {
			gNode[0] += component[k][0];
			gNode[1] += component[k][1];
			gNode[2] += component[k][2];
		}
		gNode[0] /= component.size();
		gNode[1] /= component.size();
		gNode[2] /= component.size();
		GraphNode graphNode;

		graphNode.isNullNode = 0;

		graphNode.x = gNode[0];
		graphNode.y = gNode[1];
		graphNode.z = gNode[2];

		graphNode.voxelNodes = component;

		Nodes.push_back(graphNode);
		++component_num;
	}
}


void Graph::findOstiaNodesAndRibs() {

	leftOstiaNodeID = rightOstiaNodeID = -1;
	leftOstiaRibID = rightOstiaRibID = -1;

	int nodeIndex;
	double leftMinDist = thinner->n;
	double rightMinDist = thinner->n;
	double leftDist, rightDist, dist;
	unsigned loCoords[3]; // lo := left ostium
	unsigned roCoords[3]; // ro := right ostium

	if (thinner->leftOstiaID > -1)
		thinner->getCoords(loCoords, thinner->leftThinnerOstiaInd);
	if (thinner->rightOstiaID > -1)
		thinner->getCoords(roCoords, thinner->rightThinnerOstiaInd);

	ofstream o;
	o.open("log_findOst.txt");
	if (thinner->leftOstiaID > -1)
		o << "lo: " << loCoords[0] << " " << loCoords[1] << " " << loCoords[2] << endl;
	else
		o << "lo was not computed due to leftOstiaID = -1\n";

	if (thinner->rightOstiaID > -1)
		o << "ro: " << roCoords[0] << " " << roCoords[1] << " " << roCoords[2] << endl;
	else
		o << "ro was not computed due to rightOstiaID = -1\n";

	for (unsigned i = 0; i < thinner->VoxelNodes.size(); ++i) {
		o << "\nnode candidate: " << thinner->VoxelNodes[i][0] << " " << thinner->VoxelNodes[i][1] << " " << thinner->VoxelNodes[i][2] << endl;
		nodeIndex = thinner->getVoxelNodeComponentID(thinner->VoxelNodes[i][0],
													 thinner->VoxelNodes[i][1],
													 thinner->VoxelNodes[i][2]);
		o << "nodeIndex " << nodeIndex << endl;
		if (nodeIndex < 0)
			continue;
		o << "Graph node ind: " << Nodes[nodeIndex].ID << endl;
		//TODO условие не сломается, если мы присоединяем к корню артерии дополнительную ветвь, например R conal?
		//TODO в общем случае, корень может и без присоединения иметь другую степень!
		if (Nodes[nodeIndex].degree == 1 || Nodes[nodeIndex].degree == 2) {
			double tmpVec[3];
			// leftOstium
			if (thinner->leftOstiaID > -1) {
				for (int j = 0; j < 3; ++j)
					tmpVec[j] = (double)loCoords[j] - thinner->VoxelNodes[i][j];
				o << "tmpVec " << tmpVec[0] << " " << tmpVec[1] << " " << tmpVec[2] << endl;
				dist = Utils::length(tmpVec);
				o << "left ostia dist = " << dist << endl;
				if (dist < leftMinDist) {
					leftMinDist = dist;
					leftOstiaNodeID = nodeIndex;
					leftOstiaRibID = Nodes[leftOstiaNodeID].incidentRibsID[0];
				}
				o << "left ostia MIN dist = " << leftMinDist << endl;
			}
			// rightOstium
			if (thinner->rightOstiaID > -1) {
				for (int j = 0; j < 3; ++j)
					tmpVec[j] = (double)roCoords[j] - thinner->VoxelNodes[i][j];
				dist = Utils::length(tmpVec);
				o << "right ostia dist = " << dist << endl;
				if (dist < rightMinDist) {
					rightMinDist = dist;
					rightOstiaNodeID = nodeIndex;
					rightOstiaRibID = Nodes[rightOstiaNodeID].incidentRibsID[0];
					o << "right ostia MIN dist = " << rightMinDist << endl;
				}
			}
		}
	}

	if (thinner->leftOstiaID > -1)
		o << "\nlo computed: " << Nodes[leftOstiaNodeID].x << " " << Nodes[leftOstiaNodeID].y << " " << Nodes[leftOstiaNodeID].z << endl;
	else
		o << "lo was not computed\n";

	if (thinner->rightOstiaID > -1)
		o << "ro computed: " << Nodes[rightOstiaNodeID].x << " " << Nodes[rightOstiaNodeID].y << " " << Nodes[rightOstiaNodeID].z << endl;
	else
		o << "ro was not computed\n";
	o.close();
	return;
}


void Graph::reloadGraph() {
	// переписать
	StenosisPaths.clear();
	Nodes.clear();
	Nodes = initialNodes;

	Ribs.clear();
	Ribs = initialRibs;

	finalGraphRibsCount = Ribs.size();
	finalGraphNodesCount = Nodes.size();
}


bool Graph::locateWholeStenosis(int stenosisID, int begin[3], int end[3], int type, double stenosisPersent) {
	int endSegmentsID[2];

#ifdef PRINT_LOGS_GRAPH
	ofstream o;
	o.open("locateWholeStenosis.txt");
#endif //PRINT_LOGS_GRAPH

	if (locateStenosisEnds(begin, end, endSegmentsID)) {
#ifdef PRINT_LOGS_GRAPH
		o << "locateStenosisEnds returned 0";
		o.close();
#endif //PRINT_LOGS_GRAPH  
		return 1;
	}
#ifdef PRINT_LOGS_GRAPH
	o << "locateStenosisEnds returned 0";
	o << "endSemgentsID = " << endSegmentsID[0] << ", " << endSegmentsID[1] << endl;
	o << "with markers : " << Ribs[endSegmentsID[0]].markerPointID;
	if (endSegmentsID[0] == endSegmentsID[1])
		o << " " << Ribs[endSegmentsID[0]].markerExtraPointID << endl;
	else
		o << " " << Ribs[endSegmentsID[1]].markerPointID << endl;

#endif //PRINT_LOGS_GRAPH  

	vector <int> tmpPath;
	vector <int> path(0);

#ifdef PRINT_LOGS_GRAPH
#endif //PRINT_LOGS_GRAPH  

	path.push_back(endSegmentsID[0]);
	// TODO check
	// СОСТАВЛЯЕМ ПУТЬ ИЗ СЕГМЕНТОВ МЕЖДУ КОНЦАМИ СТЕНОЗА
	if (endSegmentsID[0] == endSegmentsID[1]) {
		StenosisPaths.push_back(path);
#ifdef PRINT_LOGS_GRAPH
		o << "path consists of one edge = " << path[0] << endl;
#endif //PRINT_LOGS_GRAPH  
	} else {
#ifdef PRINT_LOGS_GRAPH
		o << "Searching for a path" << endl;
#endif //PRINT_LOGS_GRAPH  

		bool* isSegmentPassed;
		try {
			isSegmentPassed = new bool[Ribs.size()];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Bad alloc GRAPH.isSegmentedPassed");
		}
		for (unsigned i = 0; i < Ribs.size(); ++i)
			isSegmentPassed[i] = 0;
		isSegmentPassed[endSegmentsID[0]] = 1;

		vector < vector <int> > Q;
		Q.push_back(path);
		while (!Q.empty()) {
			path = *(Q.end() - 1);
			Q.erase(Q.end() - 1);
			int lastSegment = *(path.end() - 1);
			unsigned firstEndInd = Ribs[lastSegment].firstEndID;
			unsigned secondEndInd = Ribs[lastSegment].secondEndID;
			auto firstRibVector = Nodes[firstEndInd].incidentRibsID;
			auto secondRibVector = Nodes[secondEndInd].incidentRibsID;
			for (unsigned i = 0; i < firstRibVector.size(); ++i) {
				tmpPath = path;
				if (isSegmentPassed[firstRibVector[i]])
					continue;
				isSegmentPassed[firstRibVector[i]] = 1;
				tmpPath.push_back(firstRibVector[i]);
				if (firstRibVector[i] == endSegmentsID[1]) {
					StenosisPaths.push_back(tmpPath);
					Q.clear();
				} else
					Q.push_back(tmpPath);
			}
			for (unsigned i = 0; i < secondRibVector.size(); ++i) {
				tmpPath = path;
				if (isSegmentPassed[secondRibVector[i]])
					continue;
				isSegmentPassed[secondRibVector[i]] = 1;
				tmpPath.push_back(secondRibVector[i]);
				if (secondRibVector[i] == endSegmentsID[1]) {
					StenosisPaths.push_back(tmpPath);
					Q.clear();
				} else
					Q.push_back(tmpPath);
			}
		}
		delete[] isSegmentPassed;
	}

#ifdef PRINT_LOGS_GRAPH
	o << "path is found: " << endl;
	for (auto it = path.begin(); it != path.end(); it++)
		o << "  " << *(it) << endl;

	o << "NOW ADJUSTING ENDS " << endl;
#endif //PRINT_LOGS_GRAPH  

	int firstRibID = endSegmentsID[0];
	int secondRibID;
	int secondLastRibID;
	int lastRibID = endSegmentsID[1];

	int firstPathNodeID, secondPathNodeID, secondLastPathNodeID, lastPathNodeID;
	int direction;


	// СТЯГИВАЕМ КОНЦЫ
	if ((*(StenosisPaths.end() - 1)).size() == 1) {
#ifdef PRINT_LOGS_GRAPH
		o << "stenosis path has length 1\ngraph edge has length " << Ribs[firstRibID].points.size() << endl;

#endif //PRINT_LOGS_GRAPH  

		// стянуть второй конец к краю сегмента
		if (isNearEndOfSegment(Ribs[firstRibID].markerExtraPointID, firstRibID, Ribs[firstRibID].secondEndID)) {
#ifdef PRINT_LOGS_GRAPH
			o << "marker point " << Ribs[firstRibID].markerExtraPointID << " of edge " << firstRibID << " is near second end node " << Ribs[firstRibID].secondEndID << endl;
#endif //PRINT_LOGS_GRAPH  
			Ribs[firstRibID].markerExtraPointID = Ribs[firstRibID].points.size() - 1;
		} else {
#ifdef PRINT_LOGS_GRAPH
			o << "cut edge " << firstRibID << " at point " << Ribs[firstRibID].markerExtraPointID << ", because it is far from second end node " << Ribs[firstRibID].secondEndID << endl;
#endif //PRINT_LOGS_GRAPH  
			cutRibAtPoint(firstRibID, Ribs[firstRibID].markerExtraPointID, -1);
		}
		// стянуть первый конец к краю сегмента
		if (isNearEndOfSegment(Ribs[firstRibID].markerPointID, firstRibID, Ribs[firstRibID].firstEndID)) {
#ifdef PRINT_LOGS_GRAPH
			o << "marker point " << Ribs[firstRibID].markerPointID << " of edge " << firstRibID << " is near first end node " << Ribs[firstRibID].firstEndID << endl;
#endif //PRINT_LOGS_GRAPH  

			Ribs[firstRibID].markerPointID = 0;
		} else {
#ifdef PRINT_LOGS_GRAPH
			o << "cut edge " << firstRibID << " at point " << Ribs[firstRibID].markerPointID << ", because it is far from second end node " << Ribs[firstRibID].secondEndID << endl;
#endif //PRINT_LOGS_GRAPH  
			cutRibAtPoint(firstRibID, Ribs[firstRibID].markerPointID, 1);
			(*(StenosisPaths.end() - 1))[0] = Ribs.size() - 1;
		}
	}

	else if ((*(StenosisPaths.end() - 1)).size() == 2) {
		// проверяем два конца пути на близость к соответствующему концу сегмента
		// если не нужно стягивать, разрезаем сегмент на два
		// STENOSIS FIRST END

#ifdef PRINT_LOGS_GRAPH
		o << "Path has two edges of size " << Ribs[firstRibID].points.size() << " and " << Ribs[lastRibID].points.size() << endl;
#endif //PRINT_LOGS_GRAPH  


		secondPathNodeID = findGraphNodeBetweenRibs(firstRibID, lastRibID);

		firstPathNodeID = Ribs[firstRibID].firstEndID;
		if (secondPathNodeID == Ribs[firstRibID].firstEndID)
			firstPathNodeID = Ribs[firstRibID].secondEndID;

		lastPathNodeID = Ribs[lastRibID].firstEndID;
		if (secondPathNodeID == Ribs[lastRibID].firstEndID)
			lastPathNodeID = Ribs[lastRibID].secondEndID;

#ifdef PRINT_LOGS_GRAPH
		o << "firstPathNodeID = " << firstPathNodeID << endl;
		o << "secondPathNodeID = " << secondPathNodeID << endl;
		o << "lastPathNodeID = " << lastPathNodeID << endl;
#endif //PRINT_LOGS_GRAPH  


		bool firstStenosisEndNearSecondPathNode = 0;
		bool secondStenosisEndNearSecondPathNode = 0;
		if (isNearEndOfSegment(Ribs[firstRibID].markerPointID, firstRibID, secondPathNodeID))
			firstStenosisEndNearSecondPathNode = 1;
		if (isNearEndOfSegment(Ribs[lastRibID].markerPointID, lastRibID, secondPathNodeID))
			secondStenosisEndNearSecondPathNode = 1;

#ifdef PRINT_LOGS_GRAPH
		o << "firstStenosisEndNearSecondPathNode = " << firstStenosisEndNearSecondPathNode << endl;
		o << "secondStenosisEndNearSecondPathNode = " << secondStenosisEndNearSecondPathNode << endl;
#endif //PRINT_LOGS_GRAPH  

		if (firstStenosisEndNearSecondPathNode && !secondStenosisEndNearSecondPathNode) {
			// случай, когда точка разбиения ближе к вершине secondPathNodeID
			// x------------1-x---------2------x
			// x------------1-x--------------2-x
			// TODO что делать с marker, markerPoindID и в случае нескольких отметок о стенозе на этом сегменте?
			Ribs[firstRibID].markerPointID = -1;
			(*(StenosisPaths.end() - 1)).erase((*(StenosisPaths.end() - 1)).begin());
#ifdef PRINT_LOGS_GRAPH
			o << " x------------1-x---------2------x\n x------------1-x--------------2-x" << endl;
#endif //PRINT_LOGS_GRAPH  

		} else if (isNearEndOfSegment(Ribs[firstRibID].markerPointID, firstRibID, firstPathNodeID)) {
			// случай, когда точка разбиения ближе к вершине firstPathNodeID
			// x-1------------x-------2--------x
			// x-1------------x-2--------------x
			// x-1------------x--------------2-x
#ifdef PRINT_LOGS_GRAPH
			o << "x-1------------x-------2--------x\n x-1------------x-2--------------x\n x-1------------x--------------2-x" << endl;
#endif //PRINT_LOGS_GRAPH  
			Ribs[firstRibID].markerPointID = -1;
		} else {
			// остальные случаи:
			// x------------1-x-2--------------x 
			// x-------1------x-2--------------x 
			// x-------1------x-------2--------x
			// x-------1------x--------------2-x
#ifdef PRINT_LOGS_GRAPH
			o << "x------------1-x-2--------------x\n x-------1------x-2--------------x\n x-------1------x-------2--------x\n x-------1------x--------------2-x" << endl;
#endif //PRINT_LOGS_GRAPH  
			direction = 1;
			if (secondPathNodeID == Ribs[firstRibID].firstEndID)
				direction = -1;
#ifdef PRINT_LOGS_GRAPH
			o << "x------------1-x-2--------------x\n x-------1------x-2--------------x\n x-------1------x-------2--------x\n x-------1------x--------------2-x" << endl;
			o << "cutting edge " << firstRibID << " at point " << Ribs[firstRibID].markerPointID << " with direction = " << direction << endl;
#endif //PRINT_LOGS_GRAPH  
			cutRibAtPoint(firstRibID, Ribs[firstRibID].markerPointID, direction);
			if (direction == 1)
				(*(StenosisPaths.end() - 1))[0] = Ribs.size() - 1;
		}

		// STENOSIS SECOND END
		if (!firstStenosisEndNearSecondPathNode && secondStenosisEndNearSecondPathNode) {
			// x---------1-----------x--2--------------x
			// TODO что делать с marker, markerPoindID и в случае нескольких отметок о стенозе на этом сегменте?
#ifdef PRINT_LOGS_GRAPH
			o << "x---------1-----------x--2--------------x" << endl;
#endif //PRINT_LOGS_GRAPH  

			Ribs[lastRibID].markerPointID = -1;
			(*(StenosisPaths.end() - 1)).erase((*(StenosisPaths.end() - 1)).end() - 1);
		} else if (isNearEndOfSegment(Ribs[lastRibID].markerPointID, lastRibID, lastPathNodeID)) {
#ifdef PRINT_LOGS_GRAPH
			o << "x---------1-----------x--------------2-x" << endl;
			o << "markerPoint " << Ribs[lastRibID].markerPointID << " of last path edge " << lastRibID << " is close to last path node " << lastPathNodeID << endl;
#endif //PRINT_LOGS_GRAPH  
			Ribs[lastRibID].markerPointID = -1;
		} else {
			direction = 1;
			if (secondPathNodeID == Ribs[lastRibID].firstEndID)
				direction = -1;
#ifdef PRINT_LOGS_GRAPH
			o << "x------------1-x-2--------------x\n x-------1------x-2--------------x\n x-------1------x-------2--------x\n x-------1------x--------------2-x" << endl;
			o << "cutting edge " << lastRibID << " at point " << Ribs[lastRibID].markerPointID << " with direction = " << direction << endl;
#endif //PRINT_LOGS_GRAPH  

			cutRibAtPoint(lastRibID, Ribs[lastRibID].markerPointID, direction);
			if (direction == 1)
				(*(StenosisPaths.end() - 1))[(*(StenosisPaths.end() - 1)).size() - 1] = Ribs.size() - 1;
		}
	} else if ((*(StenosisPaths.end() - 1)).size() > 2) {
		// проверяем два конца пути на близость к соответствующему концу сегмента
		// если не нужно стягивать, разрезаем сегмент на два
#ifdef PRINT_LOGS_GRAPH
		o << "Path has lengh > 2 (" << (*(StenosisPaths.end() - 1)).size() << ")" << endl;
#endif //PRINT_LOGS_GRAPH
		secondRibID = (*(StenosisPaths.end() - 1))[1];
		secondPathNodeID = findGraphNodeBetweenRibs(firstRibID, secondRibID);
		firstPathNodeID = Ribs[firstRibID].firstEndID;
		if (secondPathNodeID == firstPathNodeID)
			firstPathNodeID = Ribs[firstRibID].secondEndID;

		if (isNearEndOfSegment(Ribs[firstRibID].markerPointID, firstRibID, secondPathNodeID)) {
			// TODO что делать с marker, markerPoindID и в случае нескольких отметок о стенозе на этом сегменте?
			Ribs[firstRibID].markerPointID = -1;
			(*(StenosisPaths.end() - 1)).erase((*(StenosisPaths.end() - 1)).begin());
		} else if (isNearEndOfSegment(Ribs[firstRibID].markerPointID, firstRibID, firstPathNodeID)) {
			Ribs[firstRibID].markerPointID = (Ribs[firstRibID].firstEndID == firstPathNodeID ? 0 : Ribs[firstRibID].points.size() - 1);
		} else {
			direction = 1;
			if (secondPathNodeID == Ribs[firstRibID].firstEndID)
				direction = -1;
			cutRibAtPoint(firstRibID, Ribs[firstRibID].markerPointID, direction);
			if (direction == 1)
				(*(StenosisPaths.end() - 1))[0] = Ribs.size() - 1;
		}

		// SECOND STENOSIS END
		secondLastRibID = *((*(StenosisPaths.end() - 1)).end() - 2);
		secondLastPathNodeID = findGraphNodeBetweenRibs(secondLastRibID, lastRibID);
		lastPathNodeID = Ribs[lastRibID].firstEndID;
		if (secondLastPathNodeID == lastPathNodeID)
			lastPathNodeID = Ribs[lastRibID].secondEndID;

		if (isNearEndOfSegment(Ribs[lastRibID].markerPointID, lastRibID, secondLastPathNodeID)) {
			// TODO что делать с marker, markerPoindID и в случае нескольких отметок о стенозе на этом сегменте?
			Ribs[lastRibID].markerPointID = -1;
			(*(StenosisPaths.end() - 1)).erase((*(StenosisPaths.end() - 1)).end() - 1);
		} else if (isNearEndOfSegment(Ribs[firstRibID].markerPointID, firstRibID, lastPathNodeID)) {
			Ribs[lastRibID].markerPointID = (Ribs[lastRibID].firstEndID == lastPathNodeID ? 0 : Ribs[lastRibID].points.size() - 1);
		} else {
			direction = 1;
			if (lastPathNodeID == Ribs[lastRibID].firstEndID)
				direction = -1;
			cutRibAtPoint(lastRibID, Ribs[lastRibID].markerPointID, direction);
			if (direction == 1)
				(*(StenosisPaths.end() - 1))[(*(StenosisPaths.end() - 1)).size() - 1] = Ribs.size() - 1;
		}
		// TODO написать обработку случаев для попадания концов стеноза на соседние сегменты 
	}
#ifdef PRINT_LOGS_GRAPH
	o << "ENDS HAVE BEEN ADJUSTED\n\n" << endl;
#endif //PRINT_LOGS_GRAPH

	vesselType vtype;
	if (type == 0)
		vtype = STENOSIS;
	else if (type == 1)
		vtype = STENT;
	else if (type == 2)
		vtype = FLOW3D;
#ifdef PRINT_LOGS_GRAPH
	o << "vessel type = " << vtype << endl;
#endif //PRINT_LOGS_GRAPH

	for (auto it = (*(StenosisPaths.end() - 1)).begin(); it != (*(StenosisPaths.end() - 1)).end(); it++) {
		Ribs[(*it)].stenosisPersent = stenosisPersent;
		Ribs[(*it)].marker = vtype;
	}
	finalGraphNodesCount = Nodes.size();
	finalGraphRibsCount = Ribs.size();
#ifdef PRINT_LOGS_GRAPH
	o << "vessel type = " << vtype << endl;
	o << "finalGraphNodesCount = " << finalGraphNodesCount << endl;
	o << "finalGraphRibsCount = " << finalGraphRibsCount << endl;
	o.close();

#endif //PRINT_LOGS_GRAPH
	return 0;
}


//TODO: переписать с учетом оберток и наличия двух графов.
//ribs and nodes are marked by branch label
//graph is wrapped then by LeftRibs, LeftNodes, RightRibs and RightNodes
void Graph::wrapGraph() {
	assert(Nodes.size() > 0 && Ribs.size() > 0);

	ofstream o;
	o.open("log_wrapGraph.txt");

	LeftRibs.clear(), LeftNodes.clear(), RightNodes.clear(), RightRibs.clear();
	// The next algorithm reorders indices of VoxelNodes and SkeletalSegments.
	vector<int> Q;
	unsigned segmentInd, nodeInd;
	unsigned segmentNo = 0;
	unsigned nodeNo = 0;
	unsigned firstNodeInd = 0;

	for (int i = 0; i < Ribs.size(); ++i) {
		Ribs[i].branchLabel = UNADOPTED;
		Ribs[i].labelID = -1;
	}
	for (int i = 0; i < Nodes.size(); ++i) {
		Nodes[i].branchLabel = UNADOPTED;
		Nodes[i].labelID = -1;
	}

	o << "BRANCH!\n";
	// consider all connective components of skeleton
#ifndef CEREBRAL_VESSELS
	for (int isRight = 0; isRight < 2; isRight++)
#else // CEREBRAL_VESSELS
	for (int isRight = 0; isRight < 1; isRight++)
#endif //CEREBRAL_VESSELS
	{
		o << "isRight = " << isRight << endl;
		segmentNo = 0;
		nodeNo = 0;
		// isRight==0 => wrapping left branch, isRight==1 => wrapping right branch
		int firstNodeInd = isRight ? rightOstiaNodeID : leftOstiaNodeID;
		o << "firstNodeInd = " << firstNodeInd << ", rightOstiaNodeID = " << rightOstiaNodeID << ", leftOstiaNodeID = " << leftOstiaNodeID << endl;

		if (firstNodeInd == -1) continue; // branch is not found 

		auto firstNode = Nodes[firstNodeInd];
		Nodes[firstNodeInd].labelID = nodeNo;
		Nodes[firstNodeInd].branchLabel = isRight ? RIGHT : LEFT;
		isRight ? RightNodes.push_back(firstNodeInd) : LeftNodes.push_back(firstNodeInd);
		o << "nodeNo = " << nodeNo << endl;
		++nodeNo;
		o << "RightNodes.size = " << RightNodes.size() << ", LeftNodes.size = " << LeftNodes.size() << endl;
		// Q -- is a queue for ribs in one connective graph component
		// once Q is empty, then component is passed
		for (auto iribID = firstNode.incidentRibsID.begin();
			iribID != firstNode.incidentRibsID.end(); ++iribID) {
			Q.push_back((*iribID));
			o << "push rib " << *iribID << endl;
		}
		o << "\nSTART WHILE\n";
		while (!Q.empty()) {
			//for deph ordering pop the end of the queue
			//segmentInd = *(Q.end()-1);
			//Q.erase(Q.end()-1);

			//for width ordering pop the first element of the queue
			segmentInd = *(Q.begin());
			Q.erase(Q.begin());

			o << "pop(0) segment ind " << segmentInd << ", with label " << Ribs[segmentInd].labelID << endl;

			if (Ribs[segmentInd].labelID != -1)
				continue;
			Ribs[segmentInd].labelID = segmentNo;
			Ribs[segmentInd].branchLabel = isRight ? RIGHT : LEFT;

			o << "new rib branch label = " << Ribs[segmentInd].branchLabel << " , new segmentNo" << segmentNo << endl;

			isRight ? RightRibs.push_back(segmentInd) : LeftRibs.push_back(segmentInd);

			++segmentNo;
			// find unpassed end of segment and reorder it
			// if both ends were passed continue
			nodeInd = Ribs[segmentInd].firstEndID;

			o << "next nodeInd = " << nodeInd << ", with label = " << Nodes[nodeInd].labelID << endl;

			if (Nodes[nodeInd].labelID != -1) {
				nodeInd = Ribs[segmentInd].secondEndID;
				o << "nodeInd was changed to " << nodeInd << ", with label = " << Nodes[nodeInd].labelID << endl;
				if (Nodes[nodeInd].labelID != -1)
					continue;
			}
			auto node = Nodes[nodeInd];
			Nodes[nodeInd].labelID = nodeNo;
			Nodes[nodeInd].branchLabel = isRight ? RIGHT : LEFT;
			isRight ? RightNodes.push_back(nodeInd) : LeftNodes.push_back(nodeInd);

			o << "set new nodeNo to" << nodeNo << " with branch label = " << Nodes[nodeInd].branchLabel << endl;
			++nodeNo;

			// add to queue all unpassed segments
			for (auto iribID = node.incidentRibsID.begin();
					  iribID != node.incidentRibsID.end(); iribID++) {
				if (Ribs[*(iribID)].labelID == -1) {
					Q.push_back(*(iribID));
					o << "push rib " << *iribID << endl;
				}
			}
		}
	}
	o << "DONE!" << endl;

	o << "FILL PARENT RIBS... ";
	fillParentRibs();
	o << "DONE!\n";

	o << "FILL CHILDREN RIBS... ";
	fillChildrenRibs();
	o << "DONE!\n";

	o << "FILL DIAMETERS... ";
	fillDiameters();
	o << "DONE!\n";
	o.close();

}


int Graph::findGraphNodeBetweenRibs(unsigned firstSegmentID, unsigned secondSegmentID) {
	auto firstNodeCandidateID = Ribs[firstSegmentID].firstEndID;

	if (firstNodeCandidateID == Ribs[secondSegmentID].firstEndID ||
		firstNodeCandidateID == Ribs[secondSegmentID].secondEndID)
		return firstNodeCandidateID;
	else
		return Ribs[firstSegmentID].secondEndID;
}


void Graph::cutRibAtPoint(int ribID, unsigned pointID, int stenosisDirection) {
	//TODO переписать с логикой оберток
	// разрезаем ребро с индексом ribID в точке pointID
	// новое ребро всегда записываем с концами nodeAtCutPoint, secondEndID
	// старое ребро перезаписываем с концами firstNodeID, nodeAtCutPoint

	assert(pointID < Ribs[ribID].points.size());

	GraphRib newRib;
	auto rib = Ribs[ribID];

	newRib.branchLabel = rib.branchLabel;

	newRib.firstEndID = Nodes.size();
	newRib.secondEndID = rib.secondEndID;
	Ribs[ribID].secondEndID = Nodes.size();
	// перезаписываем инцедентные ребра для второго конца исходного ребра
	for (auto i = 0; i < Nodes[rib.secondEndID].incidentRibsID.size(); i++)
		if (Nodes[rib.secondEndID].incidentRibsID[i] == rib.ID) {
			Nodes[rib.secondEndID].incidentRibsID[i] = Ribs.size();
			break;
		}
	newRib.ID = Ribs.size();

	// заполняем точки нового ребра
	newRib.points.clear();
	for (auto i = pointID; i < rib.points.size(); ++i)
		newRib.points.push_back(rib.points[i]);
	// удаляем точки из исходного ребра
	for (auto i = pointID + 1; i < rib.points.size(); ++i)
		Ribs[ribID].points.erase(Ribs[ribID].points.end() - 1);
	/*
	// БЫЛО
	  for (auto i = pointID-1; i<rib.points.size(); ++i)
		  newRib.points.push_back(rib.points[i]);
	  // удаляем точки из исходного ребра
	  for (auto i = pointID; i<rib.points.size(); ++i)
		  Ribs[ribID].points.erase(Ribs[ribID].points.end() - 1);
	*/
	// перезаписываем маркеры в зависимости от направления стеноза: marker, markerPointID
	if (stenosisDirection > 0) {
		newRib.marker = rib.marker;
		Ribs[ribID].marker = REGULAR;
		newRib.markerPointID = 0;
		if (Ribs[ribID].markerPointID == pointID)
			Ribs[ribID].markerPointID = -1;
		else
			Ribs[ribID].markerExtraPointID = -1;
	} else {
		newRib.marker = REGULAR;
		newRib.markerPointID = -1;
		if (Ribs[ribID].markerPointID == pointID)
			Ribs[ribID].markerPointID = pointID;
		else
			Ribs[ribID].markerExtraPointID = pointID;
	}
	newRib.reorderedID = -1;
	newRib.markerExtraPointID = -1;

	Ribs.push_back(newRib);

	// Добавить новую вершину графа
	GraphNode newNode;
	newNode.isNullNode = 0;
	newNode.degree = 2;
	newNode.branchLabel = newRib.branchLabel;
	newRib.labelID = -1;
	newNode.ID = Nodes.size();

	newNode.incidentRibsID.clear();
	newNode.incidentRibsID.push_back(ribID);
	newNode.incidentRibsID.push_back(newRib.ID);

	newNode.x = double(newRib.points[0][0]);
	newNode.y = double(newRib.points[0][1]);
	newNode.z = double(newRib.points[0][2]);

	newNode.voxelNodes.push_back(newRib.points[0]);
	thinner->Z[thinner->getIndex(newRib.points[0][0], newRib.points[0][1], newRib.points[0][2])] = 4 + newNode.ID;
	thinner->VoxelNodes.push_back(newRib.points[0]);

	newNode.reorderedID = -1;

	Nodes.push_back(newNode);
}

//TODO переписать
void Graph::glueRibsToTerminalPaths() {
	initialNodes = Nodes;
	initialRibs = Ribs;
	vector<int> end, begin;
	vector<vector< int> > segment;
	int nodeInd;

	vector<vector<int> >  branch;
	vector<vector<int> >  tempBranch;

	if (leftOstiaNodeID == -1 && leftOstiaRibID == -1 && rightOstiaNodeID == -1 && rightOstiaRibID == -1)
		findOstiaNodesAndRibs();

	bool* segmentIsPassed;
	try {
		segmentIsPassed = new bool[Ribs.size()];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad alloc GRAPH.cntMask");
	}

	for (unsigned i = 0; i < Ribs.size(); ++i)
		segmentIsPassed[i] = 0;

	vector<vector<vector<int> > > Queue;

	ofstream out;
	out.open("log_glueBranchesTo.txt");
	out << "left ostia node" << leftOstiaNodeID << ", rightOstiaNodeID " << rightOstiaNodeID << endl;

	TerminalPaths.clear();

	for (auto isRight = 0; isRight < 2; isRight++) {
		out << (!isRight ? "LEFT TERMINAL PATHS\n" : "RIGHT TERMINAL PATHS\n");

		// start with segments incident to the left ostia point
		if (!isRight) {
			if (leftOstiaNodeID != -1) {
				auto incRibs = Nodes[leftOstiaNodeID].incidentRibsID;
				for (auto it = incRibs.begin(); it != incRibs.end(); it++) {
					branch.clear();
					out << "pushing " << *it << " left rib, ";
					if (Ribs[*it].firstEndID == leftOstiaNodeID)
						branch = Ribs[*it].points;
					else
						for (int i = Ribs[*it].points.size() - 1; i >= 0; i--)
							branch.push_back(Ribs[*it].points[i]);
					Queue.push_back(branch);
					segmentIsPassed[(*it)] = 1;

					out << " branch begin = " << branch[0][0] << " "
						<< branch[0][1] << " "
						<< branch[0][2]
						<< ", end =  " << (*(branch.end() - 1))[0] << " "
						<< (*(branch.end() - 1))[1] << " "
						<< (*(branch.end() - 1))[2] << "\n";

				}
			}
		} else {
			// start with segments incident to the right ostia point
			if (rightOstiaNodeID != -1) {
				auto incRibs = Nodes[rightOstiaNodeID].incidentRibsID;
				for (auto it = incRibs.begin(); it != incRibs.end(); it++) {
					branch.clear();
					//out << "pushing " << *it << " right rib, ";
					if (Ribs[*it].firstEndID == rightOstiaNodeID)
						branch = Ribs[*it].points;
					else
						for (int i = Ribs[*it].points.size() - 1; i >= 0; i--)
							branch.push_back(Ribs[*it].points[i]);
					Queue.push_back(branch);
					segmentIsPassed[(*it)] = 1;

					out << " branch begin = " << branch[0][0] << " "
						<< branch[0][1] << " "
						<< branch[0][2]
						<< ", end =  " << (*(branch.end() - 1))[0] << " "
						<< (*(branch.end() - 1))[1] << " "
						<< (*(branch.end() - 1))[2] << "\n";

				}
			}
		}

		while (!Queue.empty()) {
			//counter++;
			/*
			branch = *(Queue.end()-1);
			Queue.erase(Queue.end()-1);
			end = *(branch.end()-1);
			*/
			branch = *(Queue.begin());
			Queue.erase(Queue.begin());
			end = *(branch.end() - 1);

			nodeInd = thinner->getVoxelNodeComponentID(end[0], end[1], end[2]);
			out << "label " << Nodes[nodeInd].branchLabel << endl;
			out << "branch begin " << branch[0][0] << " " << branch[0][1] << " " << branch[0][2] << endl;
			out << "branch end: " << end[0] << " " << end[1] << " " << end[2] << endl;
			out << "nodeInd " << nodeInd << ", ";
			out << "degree " << Nodes[nodeInd].degree << endl;
			// when first branch it is also terminal
			if (Nodes[nodeInd].degree == 1) {

				out << "terminal first branch!\n\n";
				TerminalPaths.push_back(branch);
				segmentIsPassed[Nodes[nodeInd].incidentRibsID[0]] = 1;
				continue;
			}
			// continue terminal path construction
			// erase branch end to evade dublication of voxel-node points
			branch.erase(branch.end() - 1);

			// copy branch to tempBranch and add corresponding segment
			bool allBranchesPassed = true;
			for (auto iter_ribID = Nodes[nodeInd].incidentRibsID.begin();
				iter_ribID != Nodes[nodeInd].incidentRibsID.end(); iter_ribID++) {
				out << "passing through segment " << *iter_ribID << endl;
				segment = Ribs[(*iter_ribID)].points;
				if (!segmentIsPassed[(*iter_ribID)]) {
					allBranchesPassed = false;
					segmentIsPassed[(*iter_ribID)] = 1;
					tempBranch = branch;
					if (nodeInd != Ribs[(*iter_ribID)].secondEndID)
						for (auto it = segment.begin(); it != segment.end(); it++)
							tempBranch.push_back(*it);
					else
						for (int j = segment.size() - 1; j >= 0; j--)
							tempBranch.push_back(segment[j]);

					// if node is terminal, then branch is found
					end = *(tempBranch.end() - 1);
					if (Nodes[thinner->getVoxelNodeComponentID(end[0], end[1], end[2])].degree == 1) {
						TerminalPaths.push_back(tempBranch);
						out << "tmp terminal!\n";
					} else {
						Queue.push_back(tempBranch);
						out << "pushing to queue\n";
					}
				}
			}
			if (allBranchesPassed) {
				TerminalPaths.push_back(branch);
				out << "pushing NON-TERMINAL PATH\n";
			}
		}
		out << "DONE!\n";

		if (!isRight) numOfLeftTerminalPaths = TerminalPaths.size();
	}
	out.close();

	//ofstream out;
	out.open("log_terminalPaths.txt");
	int count = 0;


	// get nodes on terminal paths
	NodesOnTerminalPaths.clear();
	vector<vector<int> > nodesOnCurrentPath;
	for (auto ipath = TerminalPaths.begin(); ipath != TerminalPaths.end(); ipath++) {
		out << "terminal path " << count << endl;
		count++;
		nodesOnCurrentPath.clear();
		for (auto ipoint = ipath->begin(); ipoint != ipath->end(); ipoint++) {
			if (thinner->Z[thinner->getIndex((*ipoint)[0], (*ipoint)[1], (*ipoint)[2])] > 3) {
				nodesOnCurrentPath.push_back(*ipoint);
				out << "node   " << thinner->Z[thinner->getIndex((*ipoint)[0], (*ipoint)[1], (*ipoint)[2])] - 4 << ": ";
			}
			out << "   " << (*ipoint)[0] << " " << (*ipoint)[1] << " " << (*ipoint)[2] << endl;
		}
		NodesOnTerminalPaths.push_back(nodesOnCurrentPath);
	}

	out.close();

	// index right and left paths
	terminalPathLabels.clear();
	for (auto ipath = TerminalPaths.begin(); ipath != TerminalPaths.end(); ipath++) {
		int nodeID = thinner->getVoxelNodeComponentID((*ipath)[0][0], (*ipath)[0][1], (*ipath)[0][2]);
		if (Nodes[nodeID].branchLabel == LEFT)
			terminalPathLabels.push_back(1);
		else if (Nodes[nodeID].branchLabel == RIGHT)
			terminalPathLabels.push_back(2);
	}
	numOfTerminalPaths = TerminalPaths.size();
	finalGraphRibsCount = Ribs.size();
	finalGraphNodesCount = Nodes.size();
}


void Graph::returnRibsAsTerminalPaths() {
	initialNodes = Nodes;
	initialRibs = Ribs;

	TerminalPaths.clear();
	for (auto irib = Ribs.begin(); irib != Ribs.end(); ++irib) {
		vector <vector<int> > path = irib->points;
		TerminalPaths.push_back(path);
	}

	NodesOnTerminalPaths.clear();
	vector<vector<int> > nodesOnCurrentPath;
	for (auto ipath = TerminalPaths.begin(); ipath != TerminalPaths.end(); ipath++) {
		nodesOnCurrentPath.clear();
		for (auto ipoint = ipath->begin(); ipoint != ipath->end(); ipoint++) {
			if (thinner->Z[thinner->getIndex((*ipoint)[0], (*ipoint)[1], (*ipoint)[2])] > 3) {
				nodesOnCurrentPath.push_back(*ipoint);
			}
		}
		NodesOnTerminalPaths.push_back(nodesOnCurrentPath);
	}

	// index right and left paths
	terminalPathLabels.clear();
	for (auto i = 0; i < TerminalPaths.size(); i++) {
		if (Ribs[i].branchLabel == LEFT)
			terminalPathLabels.push_back(1);
		else if (Ribs[i].branchLabel == RIGHT)
			terminalPathLabels.push_back(2);
		else
			terminalPathLabels.push_back(3);
	}

	numOfTerminalPaths = TerminalPaths.size();
	finalGraphRibsCount = Ribs.size();
	finalGraphNodesCount = Nodes.size();

}

bool Graph::locateStenosisEnds(int begin[3], int end[3], int segmentsID[2]) {
	//TODO переписать с логикой оберток
	long int minDist1 = thinner->dim[0] * thinner->dim[1] * thinner->dim[2];
	long int minDist2 = thinner->dim[0] * thinner->dim[1] * thinner->dim[2];
	int dist1, dist2;
	int beginMarkerID = -1;
	int endMarkerID = -1;

	vector<int> point(3);
	segmentsID[0] = segmentsID[1];
	for (unsigned i = 0; i < Ribs.size(); ++i)
		for (unsigned j = 0; j < Ribs[i].points.size(); ++j) {
			point = Ribs[i].points[j];
			double distVec[3];
			for (int ii = 0; ii < 3; ii++)
				distVec[ii] = point[ii] - begin[ii];
			dist1 = Utils::lengthSqrd(distVec);
			if (dist1 < minDist1) {
				minDist1 = dist1;
				segmentsID[0] = i;
				beginMarkerID = j;
			}

			for (int ii = 0; ii < 3; ii++)
				distVec[ii] = point[ii] - end[ii];
			dist2 = Utils::lengthSqrd(distVec);
			if (dist2 < minDist2) {
				minDist2 = dist2;
				segmentsID[1] = i;
				endMarkerID = j;
			}
		}

	//we suppose that markers is always near the ribs
	assert(minDist1 > 30 || minDist2 > 30);

	Ribs[segmentsID[0]].markerPointID = beginMarkerID;
	if (segmentsID[0] != segmentsID[1]) {
		Ribs[segmentsID[0]].markerExtraPointID = -1;
		Ribs[segmentsID[1]].markerExtraPointID = -1;
		Ribs[segmentsID[1]].markerPointID = endMarkerID;
		return 0;
	}
	if (beginMarkerID < endMarkerID)
		Ribs[segmentsID[1]].markerExtraPointID = endMarkerID;
	else {
		Ribs[segmentsID[0]].markerPointID = endMarkerID;
		Ribs[segmentsID[1]].markerExtraPointID = beginMarkerID;
	}
	return 0;
}


bool Graph::isNearEndOfSegment(unsigned pointID, int segmentID, int nodeID) {
	// TODO выставить размер стягивания
	unsigned length = Ribs[segmentID].points.size();
	assert(pointID < length);
	assert(nodeID == Ribs[segmentID].firstEndID || nodeID == Ribs[segmentID].secondEndID);
	if (nodeID == Ribs[segmentID].firstEndID) {
		if (2. / thinner->vsize[0] > pointID)
			return 1;
	} else if (nodeID == Ribs[segmentID].secondEndID) {
		if (5. / thinner->vsize[0] > length - pointID)
			return 1;
	}
	return 0;
}


void Graph::printGraph(ofstream& output) {
	for (auto inode = Nodes.begin(); inode != Nodes.end(); ++inode)
		printNode(output, *inode);
	for (auto irib = Ribs.begin(); irib != Ribs.end(); ++irib)
		printRib(output, *irib, 0);
	return;
}


void Graph::printNode(ofstream& o, GraphNode node) {

	o << "Node:\n ID " << node.ID << endl;
	o << " degree " << node.degree << endl;
	o << " xyz: " << node.x << " " << node.y << " " << node.z << endl;
	o << " insident ribs: ";
	auto ribs = node.incidentRibsID;
	for (auto it = ribs.begin(); it != ribs.end(); ++it)
		o << (*it) << " ";
	o << endl << " branch label " << node.branchLabel << endl;
	o << " label ID " << node.labelID << endl;
	o << " isNull " << node.isNullNode << endl;
	o << " voxel nodes:\n";
	for (auto it = node.voxelNodes.begin(); it != node.voxelNodes.end(); it++) {
		o << "     " << (*it)[0] << " " << (*it)[1] << " " << (*it)[2] << "\n";
	}
	o << endl << endl;

}


void Graph::printRib(ofstream& o, GraphRib rib, bool printPoints) {
	o << "Rib:\n ID " << rib.ID << endl;
	o << " ID reordered " << rib.reorderedID << endl;
	o << " firstEnd " << rib.firstEndID << endl;
	o << " secondEnd " << rib.secondEndID << endl;
	o << " marker " << rib.marker << endl;
	o << " pointMarker " << rib.markerPointID << endl;
	o << " pointExtraMarker " << rib.markerExtraPointID << endl;
	o << " stenosis persent " << rib.stenosisPersent << endl;
	o << " branch label " << rib.branchLabel << endl;
	o << " label ID " << rib.labelID << endl;
	o << " parentRib " << rib.parentRib << endl;
	o << " childRib " << rib.childRib << endl;
	o << " diameterCM " << rib.diameterCM << endl;
	o << " points: ";
	if (printPoints)
		for (auto it = rib.points.begin(); it != rib.points.end(); ++it)
			o << "  " << (*it)[0] << "  " << (*it)[1] << "  " << (*it)[2] << endl;
	o << endl << endl;
}

/*
void Thinner::newReorderNodesAndSegments() {
  assert(newGraphNodes.size() > 0 && newGraphRibs.size() > 0);
  // The next algorithm reorders indices of VoxelNodes and SkeletalSegments.
  vector<int> Q;
  unsigned segmentInd, nodeInd;
  unsigned segmentNo=0;
  unsigned nodeNo=0;
  unsigned firstNodeInd=0;

  for (int i=0; i<newGraphRibs.size(); ++i)
	newGraphRibs[i].reorderedID=-1;
  for (int i=0; i<newGraphNodes.size(); ++i)
	newGraphNodes[i].reorderedID=-1;

  // in case of several connective components of skeleton
  bool allNodesAreLabeled = 0;
  // consider all connective components of skeleton
  while (!allNodesAreLabeled)
  {
	// find first node, that is nearest leaf node to ostia point
	// that is also unlabeled
	{
	  double min_dist = dim[0]*dim[1]*dim[2];
	  double dist;
	  unsigned ox,oy,oz;

	  ox = ostia_ind % (dim[0]-2);
	  oy = (ostia_ind/ (dim[0]-2)) % (dim[1]-2);
	  oz = ostia_ind / ((dim[1]-2)* (dim[0]-2));

	  for (unsigned i=0; i<tjommVoxelNodes.size(); ++i)
	  {
		unsigned nodeID = Z[getIndex(VoxelNodes[i][0],VoxelNodes[i][1],VoxelNodes[i][2])]-4;
		if (newGraphNodes[nodeID].reorderedID == -1 && newGraphNodes[nodeID].degree == 1 )
		{
		  dist = sqrt((double)((ox-VoxelNodes[i][0])*(ox-VoxelNodes[i][0])
							 + (oy-VoxelNodes[i][1])*(oy-VoxelNodes[i][1])
							 + (oz-VoxelNodes[i][2])*(oz-VoxelNodes[i][2])));
		  if (dist < min_dist)
		  {
			min_dist = dist;
			firstNodeInd = nodeID;
		  }
		}
	  }
	}
	// reordering

	auto firstNode = newGraphNodes[firstNodeInd];
	newGraphNodes[firstNodeInd].reorderedID = nodeNo;
	++nodeNo;

	for (auto iribID = firstNode.incidentRibsID.begin();
			  iribID != firstNode.incidentRibsID.end(); ++iribID)
	  Q.push_back( (*iribID) );
	while (!Q.empty())
	{
	  //for deph ordering pop the end of the queue
	  //segmentInd = *(Q.end()-1);
	  //Q.erase(Q.end()-1);

	  //for width ordering pop the first element of the queue
	  segmentInd = *(Q.begin());
	  Q.erase(Q.begin());

	  if ( newGraphRibs[segmentInd].reorderedID != -1)
		continue;
	  newGraphRibs[segmentInd].reorderedID = segmentNo;
	  ++segmentNo;
	  // find unpassed end of segment and reorder it
	  // if both ends were passed continue
	  nodeInd = newGraphRibs[segmentInd].firstEndID;
	  if (newGraphNodes[nodeInd].reorderedID != -1) {
		nodeInd = newGraphRibs[segmentInd].secondEndID;
		if (newGraphNodes[nodeInd].reorderedID != -1)
		  continue;
	  }
	  auto node = newGraphNodes[nodeInd];
	  newGraphNodes[nodeInd].reorderedID = nodeNo;

	  ++nodeNo;
	  // add to queue all unpassed segments
	  for (auto iterator_ribID = node.incidentRibsID.begin();
				iterator_ribID!= node.incidentRibsID.end(); iterator_ribID++)
	  {
		if (newGraphRibs[ *(iterator_ribID)].reorderedID == -1)
		  Q.push_back( *(iterator_ribID) );
	  }
	}
	// update information on unpassed nodes
	allNodesAreLabeled = 1;
	for (auto inode = newGraphNodes.begin(); inode != newGraphNodes.end(); inode++)
	  if ( (*inode).reorderedID == -1)
	  {
		allNodesAreLabeled = 0;
		break;
	  }
  }
}
*/


void Graph::removeGaps() {
	// TODO случай, когда не найдены левая или правая ветви
	typedef vector<double> point;
	vector<point> oldConnections;
	vector<point> newConnections;


	bool changes = 1;
	while (changes) {
		changes = 0;

		oldConnections.clear();
		// push left branch nodes, right branch nodes into oldConnections and unodopted nodes into newConnections
		pushNodes(oldConnections, newConnections);

		if (newConnections.empty())
			break;

		// push ribs of left and right branches
		pushRibs(oldConnections);


		int indToConnectOld = -1; // index of oldConnections pont to connect
		int indToConnectNew = -1; // index of newConnections point to connect 
		double connectionMetric = 1e20;

		for (auto i = 0; i < newConnections.size(); i++) {
			double minMetric = 1e20; // metric between nearest newConnection point and the fixed old point
			int minNewIndWithFixedOldPoint = -1; // index of nerest newConnection point to the fixed old point 
			for (auto j = 0; j < newConnections.size(); j++) {

				double metr = metric(oldConnections[i], newConnections[j]);
				if (metr < minMetric) {
					minMetric = metr;
					minNewIndWithFixedOldPoint = j;
				}
			}
			if (minMetric < connectionMetric) {
				connectionMetric = minMetric;
				indToConnectOld = i;
				indToConnectNew = minNewIndWithFixedOldPoint;
			}
		}

		assert(indToConnectOld != -1);
		assert(indToConnectNew != -1);

		//TODO написать функцию newLineRib с учетом indToConnectOld и indToConnectNew;
		//TODO у нас есть вещественные координаты точек, нужно как-то связать их с вершинами графа или точками на ребрах 
		// newLineRib();
		changes = 1;
	}

}

double Graph::metric(vector<double> p1, vector<double> p2) {
	//TODO метрика учитывает расстояние и углы между линией, соединяющей две точки на графе, и направлениями соответствующих ребер графа
	double dist[3] = { p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2] };
	return Utils::length(dist);
}


void Graph::addLineRib(GraphNode& nodeAdopted, GraphNode& nodeUnadopted) {
	auto label = nodeAdopted.branchLabel;

	GraphRib newRib;
	newRib.branchLabel = label;
	newRib.ID = Ribs.size();
	newRib.firstEndID = nodeAdopted.ID;
	newRib.secondEndID = nodeUnadopted.ID;

	newRib.reorderedID = -1;
	newRib.marker = GAP;
	newRib.markerPointID = -1;
	newRib.markerExtraPointID = -1;

	newRib.stenosisPersent = 0;

	{ //construct points on a connection line
		double lineDirection[3];
		lineDirection[0] = nodeUnadopted.x - nodeAdopted.x;
		lineDirection[1] = nodeUnadopted.y - nodeAdopted.y;
		lineDirection[2] = nodeUnadopted.z - nodeAdopted.z;

		int numOfSteps = floor(Utils::normalize(lineDirection));
		newRib.points.clear();
		vector <int> coord(3);
		double p[3] = { nodeAdopted.x , nodeAdopted.y , nodeAdopted.z };

		for (int i = 0; i < numOfSteps - 1; ++i) {
			for (int j = 0; j < 3; j++)	coord[j] = floor(p[j] + 0.5);
			newRib.points.push_back(coord);
			for (int j = 0; j < 3; j++)	p[j] += lineDirection[i];
		}
	}


	Nodes[nodeAdopted.ID].degree++; Nodes[nodeAdopted.ID].incidentRibsID.push_back(newRib.ID);
	Nodes[nodeUnadopted.ID].degree++; Nodes[nodeUnadopted.ID].incidentRibsID.push_back(newRib.ID);
	Ribs.push_back(newRib);

	{ //TODO CHECK! правильно ли перегружать граф и оборачивать его?
		initialRibs = Ribs;
		initialNodes = Nodes;

		reloadGraph();
		wrapGraph();
	}
	return;
}

void Graph::addLineRib(GraphRib& rib, const int pointID, GraphNode& nodeUnadopted) {
	cutRibAtPoint(rib.ID, pointID, 1);
	addLineRib(*(Nodes.end() - 1), nodeUnadopted);
}

void Graph::pushRibs(vector<vector<double> > oldConnections) {
	vector<double> coord;
	for (auto irib = LeftRibs.begin(); irib != LeftRibs.end(); ++irib) {

		auto rib = Ribs[*irib].points;
		for (auto p = 1; p <= rib.size() - 1; p += 10) {
			coord[0] = rib[p][0];
			coord[1] = rib[p][1];
			coord[2] = rib[p][2];
			oldConnections.push_back(coord);
		}
	}

	// push points along the line with a step 10
	for (auto irib = RightRibs.begin(); irib != RightRibs.end(); ++irib) {

		auto rib = Ribs[*irib].points;
		for (auto p = 1; p <= rib.size() - 1; p += 10) {
			coord[0] = rib[p][0];
			coord[1] = rib[p][1];
			coord[2] = rib[p][2];
			oldConnections.push_back(coord);
		}
	}

}
void Graph::pushNodes(vector<vector<double> > oldConnections, vector<vector<double> > newConnections) {
	vector<double> coord;
	for (auto node = Nodes.begin(); node != Nodes.end(); ++node) {
		coord[0] = (*node).x;
		coord[1] = (*node).y;
		coord[2] = (*node).z;
		if ((*node).branchLabel == UNADOPTED)
			oldConnections.push_back(coord); // push unadopted nodes to new connections
		else
			newConnections.push_back(coord); // push left and right branch nodes to old connections

		oldConnections.push_back(coord);
	}
}

void Graph::removeGap3() {

	// частный случай для набора данных пациента Степкина ЕП. 
	// Известно, что одно ребро графа после разрыва в левой ветви имеет индекс 6
	// Соединим ближайшую из вершин этого ребра с ближайшим листом левой ветви
	double ribCandidate[3];
	double ribCandidateLen = 1e20;
	int leftGraphConnectionNodeInd = -1;
	int unadoptedNodeInd = -1;
	GraphNode unadoptedNode1 = Nodes[Ribs[6].firstEndID];
	GraphNode unadoptedNode2 = Nodes[Ribs[6].secondEndID];

	for (auto it = LeftNodes.begin(); it != LeftNodes.end(); ++it) {
		ribCandidate[0] = Nodes[*it].x - unadoptedNode1.x;
		ribCandidate[1] = Nodes[*it].y - unadoptedNode1.y;
		ribCandidate[2] = Nodes[*it].z - unadoptedNode1.z;
		if (Utils::length(ribCandidate) < ribCandidateLen) {
			unadoptedNodeInd = unadoptedNode1.ID;
			leftGraphConnectionNodeInd = Nodes[*it].ID;
			ribCandidateLen = Utils::length(ribCandidate);
		}
		ribCandidate[0] = Nodes[*it].x - unadoptedNode2.x;
		ribCandidate[1] = Nodes[*it].y - unadoptedNode2.y;
		ribCandidate[2] = Nodes[*it].z - unadoptedNode2.z;
		if (Utils::length(ribCandidate) < ribCandidateLen) {
			unadoptedNodeInd = unadoptedNode2.ID;
			leftGraphConnectionNodeInd = Nodes[*it].ID;
			ribCandidateLen = Utils::length(ribCandidate);
		}
	}
	Nodes[leftGraphConnectionNodeInd].degree++;
	Nodes[leftGraphConnectionNodeInd].incidentRibsID.push_back(Ribs.size());
	Nodes[unadoptedNodeInd].degree++;
	Nodes[unadoptedNodeInd].incidentRibsID.push_back(Ribs.size());

	GraphRib gapRib;
	gapRib.firstEndID = 10;
	gapRib.secondEndID = 11;
	gapRib.ID = Ribs.size();
	gapRib.reorderedID = -1;
	gapRib.stenosisPersent = 0;

	// заполняем points с шагом 1 вдоль нового ребра
	gapRib.points.clear();
	vector<double> point(3);
	point[0] = Nodes[leftGraphConnectionNodeInd].x;
	point[1] = Nodes[leftGraphConnectionNodeInd].y;
	point[2] = Nodes[leftGraphConnectionNodeInd].z;

	double direction[3];
	direction[0] = Nodes[unadoptedNodeInd].x - Nodes[leftGraphConnectionNodeInd].x;
	direction[1] = Nodes[unadoptedNodeInd].y - Nodes[leftGraphConnectionNodeInd].y;
	direction[2] = Nodes[unadoptedNodeInd].z - Nodes[leftGraphConnectionNodeInd].z;

	double len = Utils::normalize(direction);

	vector<int> pointToPush(3);
	pointToPush[0] = pointToPush[1] = pointToPush[2] = -1;
	for (int i = 0; i < (int)len; i++) {
		bool pointChanged = 0;
		// проверяем, изменился ли воксель, содержащий точку point
		for (int j = 0; j < 3; ++j)
			if (pointToPush[j] != int(0.5 + point[j])) {
				pointChanged = 1;
				break;
			}
		// если воксель поменялся, пушим его в points
		if (pointChanged) {
			for (int j = 0; j < 3; ++j)
				pointToPush[j] = int(0.5 + point[j]);
			gapRib.points.push_back(pointToPush);
		}
		for (int j = 0; j < 3; ++j)
			point[j] += direction[j];
	}
	// пушим последнюю точку
	pointToPush[0] = Nodes[unadoptedNodeInd].x;
	pointToPush[1] = Nodes[unadoptedNodeInd].y;
	pointToPush[2] = Nodes[unadoptedNodeInd].z;
	gapRib.points.push_back(pointToPush);
	gapRib.marker = REGULAR;

	Ribs.push_back(gapRib);
	return;

}

void Graph::fillDiameters() {
	for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++) {
		double averageDiameter = 0;
		for (auto j = 0; j < (*irib).points.size(); ++j)
			averageDiameter += 0.2 * thinner->findRadius((*irib).points[j], 1);
		averageDiameter /= (*irib).points.size();
		(*irib).diameterCM = averageDiameter;
	}
}

int Graph::findChild(unsigned ribID) {

	//assert(parentRibs.size() > 0);

	auto rib = Ribs[ribID];
	int parentRibID = rib.parentRib;
	int parentNodeID, childNodeID;
	if (parentRibID == -1) {
		// ostiumRib
		if (rib.firstEndID == leftOstiaNodeID || rib.firstEndID == rightOstiaNodeID) {
			childNodeID = rib.secondEndID;
		} else if (rib.secondEndID == leftOstiaNodeID || rib.secondEndID == rightOstiaNodeID) {
			childNodeID = rib.firstEndID;
		}
	} else if (parentRibID >= 0) {
		// common case
		parentNodeID = findGraphNodeBetweenRibs(ribID, parentRibID);
		if (rib.firstEndID == parentNodeID)
			childNodeID = rib.secondEndID;
		else
			childNodeID = rib.firstEndID;
	}

	// iterate through child ribs to find one with the most simmilar direction
	if (Nodes[childNodeID].degree == 1)
		return -1;
	/*
	if (Nodes[childNodeID].degree == 2) {
		if (Nodes[childNodeID].incidentRibsID[0] == ribID)
			return Nodes[childNodeID].incidentRibsID[1];
		else
			return Nodes[childNodeID].incidentRibsID[0];

	}*/
	double ribDirection[3];
	vector<int> begin, end;
	double nodeCoords[3] = { Nodes[childNodeID].x, Nodes[childNodeID].y, Nodes[childNodeID].z };

	if (rib.points.size() < 15) {
		ribDirection[0] = Nodes[rib.firstEndID].x - Nodes[rib.secondEndID].x;
		ribDirection[1] = Nodes[rib.firstEndID].y - Nodes[rib.secondEndID].y;
		ribDirection[2] = Nodes[rib.firstEndID].z - Nodes[rib.secondEndID].z;
		//	if (rib.secondEndID == parentNodeID)
		//		for (int i = 0; i < 3; i++) 
		//			ribDirection[i] *= -1;
	} else {
		bool firstPointIsChild = fabs(nodeCoords[0] - rib.points[0][0])
			+ fabs(nodeCoords[1] - rib.points[0][1])
			+ fabs(nodeCoords[2] - rib.points[0][2]) < 5;
		if (!firstPointIsChild) {
			// last rib point is the child node
			begin = rib.points[rib.points.size() - 1];
			end = rib.points[rib.points.size() - 11];
			for (int i = 0; i < 3; i++)
				ribDirection[i] = end[i] - begin[i];
		} else {
			// first rib point is the child node
			begin = rib.points[0];
			end = rib.points[10];
			for (int i = 0; i < 3; i++)
				ribDirection[i] = end[i] - begin[i];
		}
	}
	Utils::normalize(ribDirection);

	double iribDir[3];
	double maxCos = 0;
	int nearestChildID;

	for (auto i : Nodes[childNodeID].incidentRibsID) {
		if (i == ribID)
			continue;
		auto iribPoints = Ribs[i].points;

		if (iribPoints.size() < 15) {
			iribDir[0] = Nodes[Ribs[i].firstEndID].x - Nodes[Ribs[i].secondEndID].x;
			iribDir[1] = Nodes[Ribs[i].firstEndID].y - Nodes[Ribs[i].secondEndID].y;
			iribDir[2] = Nodes[Ribs[i].firstEndID].z - Nodes[Ribs[i].secondEndID].z;
		} else {
			bool firstPointIsChild = fabs(nodeCoords[0] - iribPoints[0][0])
				+ fabs(nodeCoords[1] - iribPoints[0][1])
				+ fabs(nodeCoords[2] - iribPoints[0][2]) < 5;
			if (!firstPointIsChild) {
				// last rib point is the child node
				begin = iribPoints[iribPoints.size() - 1];
				end = iribPoints[iribPoints.size() - 11];
			} else {
				// first rib point is the child node
				begin = iribPoints[0];
				end = iribPoints[10];
			}
			for (int ii = 0; ii < 3; ii++)
				iribDir[ii] = end[ii] - begin[ii];
		}
		Utils::normalize(iribDir);


		double currentCos = fabs(iribDir[0] * ribDirection[0] + iribDir[1] * ribDirection[1] + iribDir[2] * ribDirection[2]);

		if (currentCos > maxCos) {
			maxCos = currentCos;
			nearestChildID = i;
		}
	}
	return nearestChildID;
}


double Graph::meanDiameterOnChildSegment(unsigned ribID, unsigned numOfVoxels) {
	ofstream log;
	log.open("log.meanDiameterOnChildSegment.txt");


	GraphRib& rib = Ribs[ribID];
	log << "ribID " << ribID << endl;
	log << "child " << rib.childRib << endl;
	auto nodeID = findGraphNodeBetweenRibs(ribID, rib.childRib);

	log << "nodeID = " << nodeID << endl;

	GraphRib child = Ribs[rib.childRib];

	log << "child.firstEndID = " << child.firstEndID << endl;
	log << "child.secondEndID = " << child.secondEndID << endl;

	double averageDiameter = 0;
	if (child.firstEndID == nodeID) {
		log << "first" << endl;
		for (int i = 0; i < (child.points.size() > numOfVoxels ? numOfVoxels : child.points.size()); i++) {
			log << i << " " << child.points.size() << " " << numOfVoxels << endl;
			averageDiameter += 0.2 * thinner->findRadius(child.points[i], 1);
		}
	} else if (child.secondEndID == nodeID) {
		log << "second" << endl;
		int lowerBound = -1 - numOfVoxels + child.points.size();
		if (lowerBound < 0)
			lowerBound = 0;
		for (int i = child.points.size() - 1;
				 i >= lowerBound;
				 i--) {
			if (i < 0)
				break;
			//			log << i << " " << child.points.size() << " "<<  numOfVoxels << endl; 
			averageDiameter += 0.2 * thinner->findRadius(child.points[i], 1);
		}
	}
	log << averageDiameter << endl;
	log.close();
	return averageDiameter / (numOfVoxels > child.points.size() ? child.points.size() : numOfVoxels);
}

double Graph::meanDiameterOnParentSegment(unsigned ribID, unsigned numOfVoxels) {
	GraphRib& rib = Ribs[ribID];
	auto nodeID = findGraphNodeBetweenRibs(ribID, rib.parentRib);

	GraphRib& parent = Ribs[rib.parentRib];

	double averageDiameter = 0;
	if (parent.firstEndID == nodeID) {
		for (int i = 0; i < (parent.points.size() > numOfVoxels ? numOfVoxels : parent.points.size()); i++) {
			averageDiameter += 0.2 * thinner->findRadius(parent.points[i], 1);
		}
	} else if (parent.secondEndID == nodeID) {
		int lowerBound = -1 - numOfVoxels + parent.points.size();
		if (lowerBound < 0)
			lowerBound = 0;
		for (int i = parent.points.size() - 1; i >= lowerBound; i--) {
			if (i < 0)
				break;
			averageDiameter += 0.2 * thinner->findRadius(parent.points[i], 1);
		}
	}

	return averageDiameter / (numOfVoxels > parent.points.size() ? parent.points.size() : numOfVoxels);
}

void Graph::fillChildrenRibs() {
	for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++)
		(*irib).childRib = findChild((*irib).ID);
}


void Graph::fillParentRibs() {
	ofstream o;
	o.open("log_fillParrentRibs.txt");
	o << "start\nintialization\n";
	// allocate parentRibs

	queue<pair<int, int> > q; // queue of pairs (ribID, nodeID)

	for (auto it = Ribs.begin(); it != Ribs.end(); it++)
		(*it).parentRib = -2;

	o << "left ostium\n";
	if (leftOstiaNodeID >= 0) {
		for (auto ribID : Nodes[leftOstiaNodeID].incidentRibsID) {
			Ribs[ribID].parentRib = -1;
			if (Ribs[ribID].firstEndID == leftOstiaNodeID)
				q.push(make_pair(ribID, Ribs[ribID].secondEndID));
			else
				q.push(make_pair(ribID, Ribs[ribID].firstEndID));
		}
	}

	o << "right ostium\n";
	if (rightOstiaNodeID >= 0) {
		for (auto ribID : Nodes[rightOstiaNodeID].incidentRibsID) {
			Ribs[ribID].parentRib = -1;
			if (Ribs[ribID].firstEndID == rightOstiaNodeID)
				q.push(make_pair(ribID, Ribs[ribID].secondEndID));
			else
				q.push(make_pair(ribID, Ribs[ribID].firstEndID));
		}
	}

	o << "start main queue\n";
	int iter = 0;
	while (!q.empty()) {
		auto indexPair = q.front();
		q.pop();
		int parentRibID = indexPair.first;
		//assert(parentRibs[parentRibID] > -2);
		int nodeID = indexPair.second;
		o << iter << ", parentRibID = " << parentRibID << ", nodeID " << nodeID << endl;

		for (auto ribID : Nodes[nodeID].incidentRibsID) {
			if (ribID == parentRibID)
				continue;
			Ribs[ribID].parentRib = parentRibID;
			if (Ribs[ribID].firstEndID == nodeID)
				q.push(make_pair(ribID, Ribs[ribID].secondEndID));
			else
				q.push(make_pair(ribID, Ribs[ribID].firstEndID));
		}
		iter++;
		if (iter > Ribs.size())
			break;

	}
	o << "end\n";
	o.close();

}


void Graph::removeGaps_HFD1P2() {

	// частный случай для heartFlow/disk1/pat2  
	// здесь мы соединяем ближайшие вершины неадаптированных ветвей к вершинам адаптированных


	vector<GraphNode> NodesWereAdded; // null nodes or nodes on cutted ribs
	vector<GraphRib> RibsWereAdded; // gap ribs

	// TODO переписать: присоединяем не к адаптированной, а к непройденной компоненте, завершаем, когда уже не останется неадоптированных ребер.
	ofstream out;
	out.open("log_removeGaps.txt");

	out << "node labels:\n";
	for (auto inode = Nodes.begin(); inode != Nodes.end(); ++inode) {
		out << (*inode).ID << " " << (*inode).branchLabel << endl;
		(*inode).selected = 0;
	}
	out << endl << endl;

	out << "unadoptedRibs:\n";
	vector<int> unadoptedRibs;
	for (auto irib = Ribs.begin(); irib != Ribs.end(); ++irib) {
		(*irib).selected = 0;
		if (irib->branchLabel == UNADOPTED) {
			unadoptedRibs.push_back(irib->ID);
			out << irib->ID << " ";
		}
	}
	out << "\nTOTAL " << unadoptedRibs.size() << " UNADOPTED RIBS\n\n";

	for (auto iurib = unadoptedRibs.begin(); iurib != unadoptedRibs.end(); iurib++) {

		// проходим по всем неадоптированным, непройденным ребрам графа и строим по ним компоненты связности
		if (Ribs[*iurib].selected || Ribs[*iurib].branchLabel != UNADOPTED)
			continue;
		out << "unadopted rib " << Ribs[*iurib].ID << " selected: " << Ribs[*iurib].selected << ", is Unodopted: " << (Ribs[*iurib].branchLabel == UNADOPTED) << "\n";
		out << "\nSELECTING GRAPH COMPONENT...\n";
		selectGraphComponent(*iurib);
		out << SelectedComponentNodes.size() << "selected nodes, " << SelectedComponentRibs.size() << " selected ribs\n";
		//		double ribCandidate[3];
		//		double ribCandidateLen = 1e20;
		//		int leftGraphConnectionNodeInd = -1;
		//		int unadoptedNodeInd = -1;

		unsigned nearestAdoptedNodeInd, nearestUnadoptedNodeInd;
		double minPenalty = 1e+20;

#ifdef CONNECT_TO_NODE
		{
			// Находим две вершины для соединения
			minPenalty = 1e+20;
			// connect the unadopted branch to the nearest adopted leaf
			for (auto compNode_it = SelectedComponentNodes.begin(); compNode_it != SelectedComponentNodes.end(); compNode_it++) {
				if (Nodes[*compNode_it].degree > 1) continue;
				double p[3] = { Nodes[*compNode_it].x, Nodes[*compNode_it].y , Nodes[*compNode_it].z };
				double penalty = 1e+20;
				auto adoptedNodeID = getNearestAdoptedNode(p, penalty);
				assert(Nodes[adoptedNodeId].branchLabel != UNADOPTED);
				assert(fabs(penalty) < 1e+10); // эту проверку потом можно будет убрать
				if (penalty < minPenalty) {
					minPenalty = penalty;
					nearestAdoptedNodeInd = adoptedNodeID;
					nearestUnadoptedNodeInd = *compNode_it;
				}
			}

			out << "Component connection: \n";
			out << "mindist = " << minDist << endl;
			out << "adopted node = " << nearestAdoptedNodeInd << "\nUnadopted node " << nearestUnadoptedNodeInd << "\n";
			//Bexit(0);
		}
#endif //CONNECT_TO_NODE
#ifdef CONNECT_TO_RIB_POINT
		{
			// connect the unadopted branch to the nearest point on the rib
			minPenalty = 1e+20;

			unsigned nearestAdoptedRibInd;
			unsigned nearestAdoptedRibPointID;
			for (auto compNode_it = SelectedComponentNodes.begin(); compNode_it != SelectedComponentNodes.end(); compNode_it++) {
				if (Nodes[*compNode_it].degree > 1) continue;
				double p[3] = { Nodes[*compNode_it].x, Nodes[*compNode_it].y , Nodes[*compNode_it].z };
				double penalty = 1e+20;
				unsigned adoptedRibPointID;
				unsigned adoptedRibID;

				//adoptedRibID = getNearestAdoptedRibPoint(p, adoptedRibPointID, penalty);
				adoptedRibID = getNearestAdoptedRibPoint(*compNode_it, adoptedRibPointID, penalty);
				out << "unadopted node " << p[0] << " " << p[1] << " " << p[2] << ", "
					<< "adopted point " << Ribs[adoptedRibID].points[adoptedRibPointID][0] << " "
					<< Ribs[adoptedRibID].points[adoptedRibPointID][1] << " "
					<< Ribs[adoptedRibID].points[adoptedRibPointID][2] << "\n"
					<< "adopted rib = " << adoptedRibID
					<< " adopted rib point ID = "
					//<< adoptedRibPointID << ", penalty = " << penalty<< "\n";
					<< adoptedRibPointID << ", penalty = " << penalty << "\n";



				// assert(Ribs[adoptedRibId].branchLabel != UNADOPTED);
				assert(fabs(penalty) < 1e+10); // эту проверку потом можно будет убрать

				if (penalty < minPenalty) {
					minPenalty = penalty;
					nearestAdoptedRibInd = adoptedRibID;
					nearestAdoptedRibPointID = adoptedRibPointID;
					nearestUnadoptedNodeInd = *compNode_it;
				}
			}
			// add new node at selected adoted rib point
			// TODO стянуть точку к вершине или разрезать 
			out << "BEFORE STRETCHING: adopted rib = " << nearestAdoptedRibInd << "\nadopted rib point ID = " << nearestAdoptedRibPointID << "\n";

			bool swapRibEnds = 0;
			{
				int firstEnd = Ribs[nearestAdoptedRibInd].firstEndID;
				auto firstPoint = Ribs[nearestAdoptedRibInd].points[0];
				double firstCoord[3] = { Nodes[firstEnd].x , Nodes[firstEnd].y , Nodes[firstEnd].z };
				int secondEnd = Ribs[nearestAdoptedRibInd].secondEndID;
				double secondCoord[3] = { Nodes[secondEnd].x , Nodes[secondEnd].y , Nodes[secondEnd].z };
				double distToFirstSqrd = (firstCoord[0] - firstPoint[0]) * (firstCoord[0] - firstPoint[0]) +
					(firstCoord[1] - firstPoint[1]) * (firstCoord[1] - firstPoint[1]) +
					(firstCoord[2] - firstPoint[2]) * (firstCoord[2] - firstPoint[2]);
				double distToSecondSqrd = (secondCoord[0] - firstPoint[0]) * (secondCoord[0] - firstPoint[0]) +
					(secondCoord[1] - firstPoint[1]) * (secondCoord[1] - firstPoint[1]) +
					(secondCoord[2] - firstPoint[2]) * (secondCoord[2] - firstPoint[2]);
				if (distToFirstSqrd > distToSecondSqrd) {
					out << "\nSWAP RIB ENDS (edge points ordered from secondEnd to first)\n\n";
					swapRibEnds = true;
				}
			}

			if (nearestAdoptedRibPointID < 5) {
				out << "taking the begin of the rib";

				if (swapRibEnds)
					nearestAdoptedNodeInd = Ribs[nearestAdoptedRibInd].secondEndID;
				else
					nearestAdoptedNodeInd = Ribs[nearestAdoptedRibInd].firstEndID;
				nearestAdoptedRibPointID = 0;

				nullNode.ID = -1;
				nullNode.branchLabel = UNADOPTED;
				nullNode.degree = 0;
				nullNode.isNullNode = true;
				NodesWereAdded.push_back(nullNode);
			} else if (nearestAdoptedRibPointID > Ribs[nearestAdoptedRibInd].points.size() - 5) {
				out << "taking the end of the rib";
				if (swapRibEnds)
					nearestAdoptedNodeInd = Ribs[nearestAdoptedRibInd].firstEndID;
				else
					nearestAdoptedNodeInd = Ribs[nearestAdoptedRibInd].secondEndID;
				nearestAdoptedRibPointID = Ribs[nearestAdoptedRibInd].points.size() - 1;

				//we do not add new node, so fill the stack with 
				nullNode.ID = -1;
				nullNode.branchLabel = UNADOPTED;
				nullNode.degree = 0;
				nullNode.isNullNode = true;
				NodesWereAdded.push_back(nullNode);
			} else {
				out << "cutting rib\n";
				cutRibAtPoint(nearestAdoptedRibInd, nearestAdoptedRibPointID, 1);
				nearestAdoptedNodeInd = Nodes.size() - 1;

				NodesWereAdded.push_back(Nodes[Nodes.size() - 1]);
			}
			out << "Component connection: \n";
			out << "min penalty = " << minPenalty << endl;
			out << "adopted node = " << nearestAdoptedNodeInd << "\nUnadopted node " << nearestUnadoptedNodeInd << "\n";
			out << "adopted rib = " << nearestAdoptedRibInd << "\nadopted rib point ID = " << nearestAdoptedRibPointID << "\n";
		}
#endif //CONNECT_TO_RIB_POINT

		// Здесь мы нашли кандидатов на соединение: лист неадоптированной компоненты и ближайшую вершину адоптированной.
		// Теперь соединяем компоненты графа

		for (auto it = SelectedComponentNodes.begin(); it != SelectedComponentNodes.end(); it++)
			Nodes[*it].branchLabel = Nodes[nearestAdoptedNodeInd].branchLabel;
		for (auto it = SelectedComponentRibs.begin(); it != SelectedComponentRibs.end(); it++)
			Ribs[*it].branchLabel = Nodes[nearestAdoptedNodeInd].branchLabel;


		Nodes[nearestAdoptedNodeInd].degree++;
		Nodes[nearestAdoptedNodeInd].incidentRibsID.push_back(Ribs.size());
		Nodes[nearestUnadoptedNodeInd].degree++;
		Nodes[nearestUnadoptedNodeInd].incidentRibsID.push_back(Ribs.size());

		GraphRib gapRib;
		gapRib.firstEndID = nearestAdoptedNodeInd;
		gapRib.secondEndID = nearestUnadoptedNodeInd;
		gapRib.ID = Ribs.size();
		gapRib.reorderedID = -1;
		gapRib.selected = 0;
		gapRib.stenosisPersent = 0;
		gapRib.branchLabel = Nodes[nearestAdoptedNodeInd].branchLabel;
		gapRib.isGapRib = 1;
		// заполняем points с шагом 1 вдоль нового ребра
		gapRib.points.clear();
		vector<double> point(3);
		point[0] = Nodes[nearestAdoptedNodeInd].x;
		point[1] = Nodes[nearestAdoptedNodeInd].y;
		point[2] = Nodes[nearestAdoptedNodeInd].z;

		double direction[3];
		direction[0] = Nodes[nearestUnadoptedNodeInd].x - Nodes[nearestAdoptedNodeInd].x;
		direction[1] = Nodes[nearestUnadoptedNodeInd].y - Nodes[nearestAdoptedNodeInd].y;
		direction[2] = Nodes[nearestUnadoptedNodeInd].z - Nodes[nearestAdoptedNodeInd].z;

		double len = Utils::normalize(direction);

		vector<int> pointToPush(3);
		pointToPush[0] = pointToPush[1] = pointToPush[2] = -1;
		for (int i = 0; i < (int)len; i++) {
			bool pointChanged = 0;
			// проверяем, изменился ли воксель, содержащий точку point
			for (int j = 0; j < 3; ++j)
				if (pointToPush[j] != int(0.5 + point[j])) {
					pointChanged = 1;
					break;
				}
			// если воксель поменялся, пушим его в points
			if (pointChanged) {
				for (int j = 0; j < 3; ++j)
					pointToPush[j] = int(0.5 + point[j]);
				gapRib.points.push_back(pointToPush);
			}
			for (int j = 0; j < 3; ++j)
				point[j] += direction[j];
		}
		// пушим последнюю точку
		pointToPush[0] = Nodes[nearestUnadoptedNodeInd].x;
		pointToPush[1] = Nodes[nearestUnadoptedNodeInd].y;
		pointToPush[2] = Nodes[nearestUnadoptedNodeInd].z;
		gapRib.points.push_back(pointToPush);
		gapRib.marker = REGULAR;
		gapRib.markerPointID = -1;
		gapRib.markerExtraPointID = -1;

		Ribs.push_back(gapRib);
		out << "GAP RIB:\n";
		printRib(out, gapRib, 1);

		out << "ADOPTED RIB:\n";
		printRib(out, Ribs[15], 1);

		out << "UNADOPTED RIB:\n";
		printRib(out, Ribs[Nodes[nearestUnadoptedNodeInd].incidentRibsID[0]], 1);
		RibsWereAdded.push_back(gapRib);

		//break;
	} // конец прохода по всех неадоптированным ребрам.

	GapRibsStack.push_back(RibsWereAdded);
	GapNodesStack.push_back(NodesWereAdded);
	return;
}

void Graph::selectGraphComponent(unsigned firstRibNo) {
	// The next algorithm selects connected component of graph with a given ribNo.
	// It sets label "selected" on Nodes and Ribs and wraps graph by SelectedComponentRibs and SelectedComponentNodes
	assert(firstRibNo < Ribs.size());

	SelectedComponentRibs.clear(), SelectedComponentNodes.clear();
	for (int i = 0; i < Ribs.size(); ++i)
		Ribs[i].selected = 0;
	for (int i = 0; i < Nodes.size(); ++i)
		Nodes[i].selected = 0;

	vector<int> Q;
	unsigned ribInd, nodeInd;

	//ofstream out;
	//out.open("log_selectGraphComponent.txt");

	auto firstRib = Ribs[firstRibNo];
	//out << "pushing rib " << firstRib.ID;
	Q.push_back(firstRib.ID);
	//out << "\nQ size = " << Q.size() << "\n"; 
	// Q -- is a queue for ribs in one connective graph component
	// once Q is empty, then component is passed
	while (!Q.empty()) {
		//for deph ordering pop the end of the queue
		//segmentInd = *(Q.end()-1);
		//Q.erase(Q.end()-1);

		//for width ordering pop the first element of the queue
		//out << "erasing ";
		ribInd = *(Q.begin());
		Q.erase(Q.begin());
		//out << ribInd << " rib\n";
		//out << "is selected:" << Ribs[ribInd].selected << "\n";
		if (Ribs[ribInd].selected)
			continue;
		Ribs[ribInd].selected = 1;
		SelectedComponentRibs.push_back(ribInd);
		//out << "Pushing rib " << ribInd << " to SelectedComponentRibs of size " << SelectedComponentRibs.size() << "\n";

		// check first end
		nodeInd = Ribs[ribInd].firstEndID;
		//out << "FIRST NODE " << nodeInd << " , selected: " << Nodes[nodeInd].selected << "\n";
		if (!Nodes[nodeInd].selected) {

			auto node = Nodes[nodeInd];
			Nodes[nodeInd].selected = 1;
			SelectedComponentNodes.push_back(nodeInd);

			//out << "pushing unselected ribs: ";
			for (auto iribID = node.incidentRibsID.begin();
				iribID != node.incidentRibsID.end(); iribID++) {
				if (!Ribs[*(iribID)].selected) {
					Q.push_back(*(iribID));
					//		out << (*iribID) << " ";
				}
			}
			//	out << endl;
		}
		// check secondEnd
		nodeInd = Ribs[ribInd].secondEndID;
		//out << "SECOND NODE " << nodeInd << " , selected: " << Nodes[nodeInd].selected << "\n";
		if (!Nodes[nodeInd].selected) {
			auto node = Nodes[nodeInd];
			Nodes[nodeInd].selected = 1;
			SelectedComponentNodes.push_back(nodeInd);
			// add to queue all unpassed segments
			//out << "pushing unselected ribs: ";
			for (auto iribID = node.incidentRibsID.begin();
			iribID != node.incidentRibsID.end(); iribID++) {
				if (!Ribs[*(iribID)].selected) {
					Q.push_back(*(iribID));
					//	out << (*iribID) << " ";
				}
			}
			//out << endl;
		}
	}
	//out.close();
	return;
}

unsigned Graph::getNearestAdoptedNode(double p[3], double& minDistSqrd_out) {
	ofstream out;

	out.open("log_getNearestAdoptedNode_" + to_string(p[0]) + "_" + to_string(p[1]) + "_" + to_string(p[2]) + ".txt");
	// returns ID of the nearest Adopted Node
	double dist_sqrd;
	double minDist_sqrd = 1e+20;
	int nearestNodeID = -1;
	for (auto inode = Nodes.begin(); inode != Nodes.end(); ++inode) {
		if ((*inode).branchLabel == UNADOPTED)
			continue;
		dist_sqrd = ((*inode).x - p[0]) * ((*inode).x - p[0])
			+ ((*inode).y - p[1]) * ((*inode).y - p[1])
			+ ((*inode).z - p[2]) * ((*inode).z - p[2]);
		out << "node " << (*inode).ID << ", unadopted:" << ((*inode).branchLabel == UNADOPTED) << ", dist = " << dist_sqrd << endl;

		if (dist_sqrd < minDist_sqrd) {
			minDist_sqrd = dist_sqrd;
			nearestNodeID = (*inode).ID;
		}
	}
	out << "min dist = " << minDist_sqrd << endl << "nearest node id = " << nearestNodeID << endl;
	out.close();
	minDistSqrd_out = minDist_sqrd;
	return nearestNodeID;
}

//unsigned Graph::getNearestAdoptedRibPoint(double p[3], unsigned &ribPointID, double &dist) {
unsigned Graph::getNearestAdoptedRibPoint(int nodeID, unsigned& ribPointID, double& penalty) {
	// this algorithm returns nearest rib ID and writes ID of the nearest rib point onto ribPointID
	assert(nodeID > 0 && nodeID < Nodes.size());
	assert(Nodes[nodeID].branchLabel == UNADOPTED);

	ofstream out;
	out.open("log_getNearestAdoptedRibPoint.txt");

	double norm, weight;
	double minPenalty = 1e+20;

	double p[3] = { Nodes[nodeID].x, Nodes[nodeID].y, Nodes[nodeID].z };
	double weights[3] = { 0, 0, 0 };
	double dist;
	int nearestRibID = -1;
	unsigned nearestRibPointID;
	for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++) {
		//if ((*irib).branchLabel == UNADOPTED)
		if ((*irib).selected)
			continue;
		out << "\n\n SEARCHING ON RIB " << irib->ID << endl << endl;
		auto points = (*irib).points;
		for (int pID = 0; pID < points.size(); pID++) {
			out << "p = [" << p[0] << " " << p[1] << " " << p[2] << "], ribPoint = ["
				<< points[pID][0] << " " << points[pID][1] << " " << points[pID][2] << "]\n";
			dist = sqrt((p[0] - points[pID][0]) * (p[0] - points[pID][0])
							+ (p[1] - points[pID][1]) * (p[1] - points[pID][1])
							+ (p[2] - points[pID][2]) * (p[2] - points[pID][2]));



			norm = dist;
			out << "dist = " << dist;
#ifndef USE_ONLY_DIST
			weight = getDirectionWeights(nodeID, irib->ID, pID, weights);
			+weight;
			out << ", direction weights = [" << weights[0] << ", " << weights[1] << ", " << weights[2] << "], norm = " << norm;

#endif
			out << "\n";
			if (minPenalty > norm) {
				minPenalty = norm;
				nearestRibID = (*irib).ID;
				nearestRibPointID = pID;
			}
			/*
			if (minDist_sqrd > dist_sqrd) {
				minDist_sqrd = dist_sqrd;
				nearestRibID = (*irib).ID;
				nearestRibPointID = pID;
			}*/
		}
	}
	out << "nearestRibPointID " << nearestRibPointID << ", minPenalty = " << minPenalty << ", nearestRibID =" << nearestRibID << "\n";
	out << "DONE!\n";
	out.close();
	ribPointID = nearestRibPointID;
	penalty = minPenalty;
	return nearestRibID;
}


int Graph::numOfRibsToOstium(unsigned ribID, int& parentRibID) {
	assert(ribID < Ribs.size());
	assert(Ribs[ribID].branchLabel == LEFT || Ribs[ribID].branchLabel == RIGHT);
	unsigned ostiaNodeID = (Ribs[ribID].branchLabel == LEFT ? leftOstiaNodeID : rightOstiaNodeID);
	assert(ostiaNodeID >= 0);

	bool* ribPassed;
	try {
		ribPassed = new bool[Ribs.size()];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad alloc GRAPH.ribPassed");
	}

	for (auto i = 0; i < Ribs.size(); ++i)
		ribPassed[i] = 0;
	ribPassed[ribID] = 1;
	vector<int> ribPath, newRibPath;
	ribPath.push_back(ribID);
	vector<vector<int>> Q; // queue for rib paths
	Q.push_back(ribPath);
	while (!Q.empty()) {
		ribPath = *(Q.end() - 1);
		Q.erase(Q.end() - 1);

		auto lastRibID = *(ribPath.end() - 1);
		auto firstNode = Nodes[Ribs[lastRibID].firstEndID];
		auto secondNode = Nodes[Ribs[lastRibID].secondEndID];

		if (firstNode.ID == ostiaNodeID || secondNode.ID == ostiaNodeID)
			break;

		for (auto irib = firstNode.incidentRibsID.begin(); irib != firstNode.incidentRibsID.end(); irib++) {
			if (ribPassed[*irib]) continue;
			newRibPath = ribPath;
			newRibPath.push_back(*irib);
			ribPassed[*irib] = 1;
			Q.push_back(newRibPath);
		}
		for (auto irib = secondNode.incidentRibsID.begin(); irib != secondNode.incidentRibsID.end(); irib++) {
			if (ribPassed[*irib]) continue;
			newRibPath = ribPath;
			newRibPath.push_back(*irib);
			ribPassed[*irib] = 1;
			Q.push_back(newRibPath);
		}
	}
	delete[] ribPassed;
	// ribPath here is the path from the input rib to ostium;
	if (ribPath.size() > 1)
		parentRibID = ribPath[1];
	else
		parentRibID = -1;
	return ribPath.size();
}


double Graph::getDirectionWeights(int unadoptedNodeID, int adoptedRibID, int adoptedRibPointID, double* outputWeights) {
	// returns sin of angle between ri, incident to unadoptated node 
	// and rib, incident to adopted node, nearest to ostium

	ofstream o;
	o.open("log_directionWeight.txt");
	GraphRib adoptedRib, unadoptedRib;

	o << "adoptedNodeID " << adoptedRibID
		<< ",adoptedPointID " << adoptedRibPointID
		<< ", unodoptedNodeID " << unadoptedNodeID << endl;
	unadoptedRib = Ribs[Nodes[unadoptedNodeID].incidentRibsID[0]];
	o << "unadoptedRibID = " << unadoptedRib.ID << endl;
	// get adopted rib nearest to ostium
	o << "nearest rib estimation:\n";

	int minDistToOstium = 1e+20;


	//TODO заполнить направления сосудов в зависимости от ориентации ребер
	double dirUnadopted[3], dirAdopted[3], dirAdoptedParent[3], dirLink[3];
	double adoptedToLink, adoptedToUnadopted, linkToUnadopted;

	auto pointOnRib = Ribs[adoptedRibID].points[adoptedRibPointID];
	//get direction of linking 
	dirLink[0] = Nodes[unadoptedNodeID].x - pointOnRib[0];
	dirLink[1] = Nodes[unadoptedNodeID].y - pointOnRib[1];
	dirLink[2] = Nodes[unadoptedNodeID].z - pointOnRib[2];
	Utils::normalize(dirLink);
	o << "dirLink = [" << dirLink[0] << ", " << dirLink[1] << ", " << dirLink[2] << "]\n";

	// get adopted vessel direction
	getRibDirectionAtPoint(adoptedRibID, adoptedRibPointID, dirAdopted);
	o << "dirAdopted = [" << dirAdopted[0] << ", " << dirAdopted[1] << ", " << dirAdopted[2] << "]\n";
	// get adopted vessel parent direction
	getParentRibDirection(adoptedRibID, adoptedRibPointID, dirAdoptedParent);
	o << "dirAdoptedParent = [" << dirAdoptedParent[0] << ", " << dirAdoptedParent[1] << ", " << dirAdoptedParent[2] << "]\n";

	// get unadopted vessel direction
	//auto unadoptedRib = Ribs[Nodes[unadoptedNodeID].incidentRibsID[0]];
	auto ribBegin = unadoptedRib.points[0];
	auto ribEnd = *(unadoptedRib.points.end() - 1);
	if (abs(Nodes[unadoptedNodeID].x - ribBegin[0])
		+ abs(Nodes[unadoptedNodeID].y - ribBegin[1])
		+ abs(Nodes[unadoptedNodeID].z - ribBegin[2]) <
		abs(Nodes[unadoptedNodeID].x - ribEnd[0])
		+ abs(Nodes[unadoptedNodeID].y - ribEnd[1])
		+ abs(Nodes[unadoptedNodeID].z - ribEnd[2])) {
		getRibDirectionAtPoint(unadoptedRib.ID, 0, dirUnadopted);
	} else {
		getRibDirectionAtPoint(unadoptedRib.ID, unadoptedRib.points.size() - 1, dirUnadopted);
	}
	o << "dirUnadopted = [" << dirUnadopted[0] << ", " << dirUnadopted[1] << ", " << dirUnadopted[2] << "]\n";

	outputWeights[0] = adoptedToUnadopted = 1 - Utils::dotProd(dirAdopted, dirUnadopted);
	outputWeights[1] = adoptedToLink = 1 - Utils::dotProd(dirAdopted, dirLink);
	outputWeights[2] = linkToUnadopted = 1 - Utils::dotProd(dirLink, dirUnadopted);

	o << "norm adopted to unadopted = " << adoptedToUnadopted << "\n";
	o << "norm adopted to link = " << adoptedToLink << "\n";
	o << "norm link to unadopted = " << linkToUnadopted << "\n";

	o.close();

	return outputWeights[0] + outputWeights[1] + outputWeights[2];
}


int Graph::getRibOrientation(int ribID) {
	// returns 1 if rib points ordered from ostium to terminal
	// returns -1 if rib points go in reversed direction
	assert(ribID > 0 && ribID < Ribs.size());
	assert(Ribs[ribID].branchLabel != UNADOPTED);

	int parentRibID;
	numOfRibsToOstium(ribID, parentRibID);

	auto ribBegin = Ribs[ribID].points[0];
	auto ribEnd = *(Ribs[ribID].points.end() - 1);
	if (parentRibID != -1) {
		// case of non-ostia rib
		auto parentNode = Nodes[findGraphNodeBetweenRibs(ribID, parentRibID)];
		double node[3] = { parentNode.x, parentNode.y, parentNode.z };
		if (abs(node[0] - ribBegin[0]) + abs(node[1] - ribBegin[1]) + abs(node[2] - ribBegin[2]) <
			abs(node[0] - ribEnd[0]) + abs(node[1] - ribEnd[1]) + abs(node[2] - ribEnd[2]))
			return 1;
		return -1;
	} else {
		// case of ostia rib
		int firstSecondReversed = 1;
		auto node = Nodes[Ribs[ribID].firstEndID];

		// firstEndID points to begin or end of points?
		if (abs(node.x - ribBegin[0]) + abs(node.y - ribBegin[1]) + abs(node.z - ribBegin[2]) >
			abs(node.x - ribEnd[0]) + abs(node.y - ribEnd[1]) + abs(node.z - ribEnd[2]))
			firstSecondReversed = -1;


		if (Ribs[ribID].firstEndID == leftOstiaNodeID || Ribs[ribID].firstEndID == rightOstiaNodeID) {
			// firstEndID is ostium
			return firstSecondReversed;
		} else if (Ribs[ribID].firstEndID == leftOstiaNodeID || Ribs[ribID].firstEndID == rightOstiaNodeID) {
			// secondEndID is ostium
			return -1 * firstSecondReversed;
		}
	}
}


void Graph::getRibDirectionAtPoint(int ribID, int pointID, double* direction) {
	//находит усредненное направление в данной точке ребра
	direction[0] = 0;
	direction[1] = 0;
	direction[2] = 0;

	assert(pointID >= 0 && pointID < Ribs[ribID].points.size());

	int pointsAccounted = 0;
	for (int i = 0; i < 4; i++) {
		if (pointID - i < 0) continue;
		auto firstPoint = Ribs[ribID].points[pointID - i];
		if (pointID - i + 4 >= Ribs[ribID].points.size())
			continue;
		auto secondPoint = Ribs[ribID].points[pointID - i + 4];

		double currentDir[3] = { secondPoint[0] - firstPoint[0], secondPoint[1] - firstPoint[1], secondPoint[2] - firstPoint[2] };
		Utils::normalize(currentDir);
		for (int j = 0; j < 3; j++)
			direction[j] += currentDir[j];
		pointsAccounted++;
	}
	double directionFactor = getRibOrientation(ribID);
	if (pointsAccounted == 0) {
		direction[0] = Nodes[Ribs[ribID].firstEndID].x - Nodes[Ribs[ribID].secondEndID].x;
		direction[1] = Nodes[Ribs[ribID].firstEndID].y - Nodes[Ribs[ribID].secondEndID].y;
		direction[2] = Nodes[Ribs[ribID].firstEndID].z - Nodes[Ribs[ribID].secondEndID].z;
		Utils::normalize(direction);
		for (int i = 0; i < 3; i++) direction[i] *= directionFactor;
		return;
	}
	for (int j = 0; j < 3; j++)
		direction[j] /= pointsAccounted * directionFactor;
	return;
}


void Graph::getParentRibDirection(int ribID, int pointID, double* direction) {
	// логика: 
	// находим ближайшее ребро-соседа на пути к точке устья
	// если мы сразу в ребре устья, то ищем направление в данной точке
	// если нет, то определяем направление ребра-соседа в точке стыка с данным ребром (общей вершине)
	direction[0] = 0;
	direction[1] = 0;
	direction[2] = 0;

	assert(ribID > 0 && ribID < Ribs.size());
	assert(pointID > 0 && pointID < Ribs[ribID].points.size());

	int parentRibID;
	numOfRibsToOstium(ribID, parentRibID);
	if (parentRibID == -1) {
		getRibDirectionAtPoint(ribID, pointID, direction);
		return;
	}
	// here we have the parent rib ID
	auto nodeID = findGraphNodeBetweenRibs(ribID, parentRibID);
	int nodeCoords[3] = { (int)Nodes[nodeID].x, (int)Nodes[nodeID].y, (int)Nodes[nodeID].z };

	// compute direction near the points begin or end?
	bool startFromRibBegin = false;
	auto p0 = Ribs[parentRibID].points[0];
	auto pE = *(Ribs[parentRibID].points.end() - 1);
	if (abs(nodeCoords[0] - p0[0]) + abs(nodeCoords[1] - p0[1]) + abs(nodeCoords[2] - p0[2]) <
		abs(nodeCoords[0] - pE[0]) + abs(nodeCoords[1] - pE[1]) + abs(nodeCoords[2] - pE[2]))
		startFromRibBegin = true;

	if (startFromRibBegin)
		getRibDirectionAtPoint(parentRibID, 0, direction);
	else
		getRibDirectionAtPoint(parentRibID, Ribs[parentRibID].points.size() - 1, direction);
}


void Graph::RemoveRibs(vector <int> ribIndices) {
	assert(ribIndices.size() > 0);
	assert(Ribs.size() > 0);

	std::sort(ribIndices.begin(), ribIndices.end());

	ofstream o;
	o.open("remove_ribs.txt");
	o << "Remove Ribs\n";
	printGraphOnGV(std::to_string(0));
	int counter = 1;
	// remove ribs in decsending order (ribs will be renumerate)
	for (int i = ribIndices.size() - 1; i >= 0; i--, counter++) {

		o << "  RIB INDEX " << ribIndices[i] << endl;
		RemoveRib(ribIndices[i], o);
		o << "  RIB WAS REMOVED\n\n";
		printGraphOnGV(std::to_string(counter));
	}
	o.close();
}


//TODO НОРМАЛЬНО РАБОТАЕТ УДАЛЕНИЕ ЛИСТА И РЕБРА, ПАДАЕТ ПРИ ПОПЫТКЕ УДАЛИТЬ ВНУТРЕННЕЕ РЕБРО
void Graph::RemoveRib(int ribID, ofstream& o) {
	assert(ribID < Ribs.size());
	assert(ribID >= 0);
	o << "asserts were passed\n";
	o << "                     rib id = " << ribID << endl;
	// remove rib from incidence list of first node
	GraphNode node1 = Nodes[Ribs[ribID].firstEndID];
	for (auto irib = Nodes[node1.ID].incidentRibsID.begin(); irib != Nodes[node1.ID].incidentRibsID.end(); irib++)
		if (*irib == ribID) {
			o << "remove incident rib from node 1\n";
			Nodes[node1.ID].incidentRibsID.erase(irib);
			break;
		}
	o << "decrease node1 degree\n";
	o << "\n==============================\nNode1 before:\n";
	printNode(o, Nodes[node1.ID]);
	Nodes[node1.ID].degree -= 1; // decrease node degree
	o << "\n==============================\nNode1 after:\n";
	printNode(o, Nodes[node1.ID]);
	// remove rib from incidence list of second node
	GraphNode node2 = Nodes[Ribs[ribID].secondEndID];
	for (auto irib = Nodes[node2.ID].incidentRibsID.begin(); irib != Nodes[node2.ID].incidentRibsID.end(); irib++)
		if (*irib == ribID) {
			o << "remove incident rib from node 2\n";
			Nodes[node2.ID].incidentRibsID.erase(irib);
			break;
		}
	o << "decrease node1 degree\n";

	o << "\n==============================\nNode2 before:\n";
	printNode(o, Nodes[node2.ID]);
	Nodes[node2.ID].degree -= 1;
	o << "\n==============================\nNode2 after:\n";
	printNode(o, Nodes[node2.ID]);

	o << "                               node1 id = " << node1.ID << ", node2 id = " << node2.ID << endl;
	// remove rib
	o << "push rib into stack\n";
	RemovedRibStack.push_back(Ribs[ribID]);
	o << "remove rib\n";
	Ribs.erase(Ribs.begin() + ribID);

	// update indices of Ribs
	o << "update rib indices\n";
	for (int i = ribID; i < Ribs.size(); i++)
		Ribs[i].ID -= 1;

	// update indices of incident ribs
	o << "update ribs info\n";
	for (auto inode = Nodes.begin(); inode != Nodes.end(); inode++) {
		o << " on node " << inode->ID << ":\n";
		for (auto irib = inode->incidentRibsID.begin(); irib != inode->incidentRibsID.end(); irib++) {
			if ((*irib) > ribID) {
				o << "  rib " << *irib << " -> ";
				(*irib) -= 1;
				o << *irib << endl;;
			}
		}
	}

	// remove node 1 if necessary
	bool isNode1Removed = false;
	o << "node1 degree = " << node1.degree << endl;
	if (Nodes[node1.ID].degree == 0) {
		isNode1Removed = true;
		o << "removing node1\n";
		Nodes.erase(Nodes.begin() + node1.ID);
		for (auto inode = Nodes.begin() + node1.ID; inode != Nodes.end(); inode++) {
			o << "  updating node " << inode->ID << " -> ";
			inode->ID -= 1;
			o << inode->ID << "\n";
		}

		o << "updating rib ends\n";
		for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++) {
			if (irib->firstEndID > node1.ID) {
				o << "   rib" << irib->ID << " first end: " << irib->firstEndID << " -> ";
				irib->firstEndID -= 1;
				o << irib->firstEndID << "\n";;
			}
			if (irib->secondEndID > node1.ID) {
				o << "   rib" << irib->ID << " second end: " << irib->secondEndID << " -> ";
				irib->secondEndID -= 1;
				o << irib->secondEndID << "\n";;
			}
		}
	}

	//remove node 2 if necessary
	bool isNode2Removed = false;
	o << "node2 degree = " << node2.degree << endl;
	int node2ID = node2.ID;
	if (isNode1Removed && node2.ID > node1.ID)
		node2ID -= 1;
	o << "node2 id = " << node2ID << endl;

	if (Nodes[node2ID].degree == 0) {
		isNode2Removed = true;
		// check if node2ID > node1ID. If so node2 index is need to be decremented
		o << "updated node2 id = " << node2ID << endl;
		o << "removing node2\n";
		Nodes.erase(Nodes.begin() + node2ID);
		for (auto inode = Nodes.begin() + node2ID; inode != Nodes.end(); inode++) {
			o << "  updating node " << inode->ID << "\n";
			inode->ID -= 1;
		}
		o << "updating rib ends\n";
		for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++) {
			if (irib->firstEndID > node2ID)
				irib->firstEndID -= 1;
			if (irib->secondEndID > node2ID)
				irib->secondEndID -= 1;
		}
	}
	/*
	if (isNode1Removed && leftOstiaNodeID >= node1->ID)
		leftOstiaNodeID -= 1;
	if (isNode2Removed && leftOstiaNodeID >= node2->ID)
		leftOstiaNodeID -= 1;

	if (isNode1Removed && rightOstiaNodeID >= node1->ID)
		rightOstiaNodeID -= 1;
	if (isNode2Removed && rightOstiaNodeID >= node2->ID)
		rightOstiaNodeID -= 1;
	*/



	// update VoxelNode indices in thinner->Z


	// check if it works!
	if (isNode1Removed) {
		o << "REMOVING NODE 1 FROM VOXEL NODES:\n ";
		// remove node1 voxels from VoxelNodes
		for (auto it = thinner->VoxelNodes.begin(); it != thinner->VoxelNodes.end(); ) {
			auto voxelNodeCompId = thinner->getVoxelNodeComponentID((*it)[0], (*it)[1], (*it)[2]);
			if (voxelNodeCompId == node1.ID) {
				o << "erasing voxel node [" << (*it)[0] << " " << (*it)[1] << " " << (*it)[2] << "]\n";
				thinner->VoxelNodes.erase(it);
			} else
				it++;
		}
		for (auto coord = node1.voxelNodes.begin(); coord != node1.voxelNodes.end(); coord++) {
			o << "Z[" << (*coord)[0] << " " << (*coord)[1] << " " << (*coord)[2] << "] = 0\n";
			thinner->Z[thinner->getIndex((*coord)[0], (*coord)[1], (*coord)[2])] = 0;
		}

	}
	if (isNode2Removed) {
		// remove node2 voxels from VoxelNodes
		for (auto it = thinner->VoxelNodes.begin(); it != thinner->VoxelNodes.end(); ) {
			auto voxelNodeCompId = thinner->getVoxelNodeComponentID((*it)[0], (*it)[1], (*it)[2]);
			if (voxelNodeCompId == node2.ID) {
				o << "erasing voxel node [" << (*it)[0] << " " << (*it)[1] << " " << (*it)[2] << "]\n";
				thinner->VoxelNodes.erase(it);
			} else
				it++;
		}
		o << "REMOVING NODE 2 FROM VOXEL NODES:\n ";
		for (auto coord = node2.voxelNodes.begin(); coord != node2.voxelNodes.end(); coord++) {
			o << "Z[" << (*coord)[0] << " " << (*coord)[1] << " " << (*coord)[2] << "] = 0\n";
			thinner->Z[thinner->getIndex((*coord)[0], (*coord)[1], (*coord)[2])] = 0;
		}
	}


	o << "\n\nREDUCING VOXEL NODES:\n\n";
	for (auto ivn = thinner->VoxelNodes.begin(); ivn != thinner->VoxelNodes.end(); ++ivn) {
		int x = (*ivn)[0];
		int y = (*ivn)[1];
		int z = (*ivn)[2];

		int currentID = thinner->getVoxelNodeComponentID(x, y, z);

		o << "node [" << x << " " << y << " " << z << " with comp id = " << currentID << " -> ";
		if (isNode1Removed) {
			if (currentID > node1.ID) {
				thinner->Z[thinner->getIndex(x, y, z)] -= 1;
			}
		}
		if (isNode2Removed) {
			if (currentID > node2.ID) {
				thinner->Z[thinner->getIndex(x, y, z)] -= 1;
			}
		}
		o << thinner->getVoxelNodeComponentID(x, y, z) << endl;
	}

	// push node pair into the removedNodeStack
	o << "pushing to node stack\n";
	nullNode.isNullNode = 1;
	if (isNode1Removed && isNode2Removed)
		RemovedNodeStack.push_back(make_pair(node1, node2));
	else if (isNode1Removed && !isNode2Removed)
		RemovedNodeStack.push_back(make_pair(node1, nullNode)); //is this work?
	else if (!isNode1Removed && isNode2Removed)
		RemovedNodeStack.push_back(make_pair(nullNode, node2)); //is this work?
	else
		RemovedNodeStack.push_back(make_pair(nullNode, nullNode)); //is this work?
	o << "\n====================\n\nRemovedRibStack.size() = " << RemovedRibStack.size() << endl;
	for (auto it = RemovedRibStack.begin(); it != RemovedRibStack.end(); it++) {
		o << "REMOVED RIB: \n";
		printRib(o, *it, 0);
	}

	o << "\n====================\n\nRemovedNodeStack.size() = " << RemovedNodeStack.size() << endl;
	for (auto it = RemovedNodeStack.begin(); it != RemovedNodeStack.end(); it++) {
		o << "REMOVED NODE PAIR: \n";
		o << "    FIRST:\n";
		printNode(o, (*it).first);
		o << "    SECOND:\n";
		printNode(o, (*it).second);
	}

	o << endl << endl;

}

bool Graph::checkVoxelNodesUpToDate() {

	// check if every voxel node represents correct voxel in thinner Z
	for (auto it = thinner->VoxelNodes.begin(); it != thinner->VoxelNodes.end(); it++) {
		auto p = *it;
		if (thinner->getVoxelNodeComponentID(p[0], p[1], p[2]) < 0) {
			ofstream o;
			o.open("log_checkVoxelNodesUpToDate.txt");
			o << "Voxel Node [" << p[0] << " " << p[1] << " " << p[2] << "] is no longer voxel node in thinner->Z\n";
			o.close();
			return false;
		}
	}

	// check if every voxel with Z[voxel] = voxelNodeCompNum + 4 has its VoxelNode
	for (auto i = 0; i < thinner->n; i++) {
		int coord[3] = { i % thinner->dim[0], i / thinner->dim[0] % thinner->dim[1], i / thinner->dim[0] / thinner->dim[1] };
		if (thinner->getVoxelNodeComponentID(coord[1], coord[2], coord[3]) > 0) {
			bool foundCorrespondance = false;
			for (auto ivn = thinner->VoxelNodes.begin(); ivn != thinner->VoxelNodes.end(); ivn++) {
				if ((*ivn)[0] == coord[0] && (*ivn)[1] == coord[1] && (*ivn)[2] == coord[2]) {
					foundCorrespondance = true;
					break;
				}
			}
			if (!foundCorrespondance) {
				ofstream o;
				o.open("log_checkVoxelNodesUpToDate.txt");
				o << "No Voxel Node that corresponds to thinner->Z point [" << coord[0] << " " << coord[1] << " " << coord[2] << "\n";
				o.close();
				return false;
			}
		}
	}

	// check if every voxel node represents correct voxel points in Graph Nodes
	for (auto it = thinner->VoxelNodes.begin(); it != thinner->VoxelNodes.end(); it++) {
		auto p = *it;
		auto voxelNodeCompID = thinner->getVoxelNodeComponentID(p[0], p[1], p[2]);
		bool foundCorrespondance = false;
		for (auto ipoint = Nodes[voxelNodeCompID].voxelNodes.begin(); ipoint != Nodes[voxelNodeCompID].voxelNodes.end(); ipoint++) {
			if ((*ipoint)[0] == p[0] && (*ipoint)[1] == p[1] && (*ipoint)[2] == p[2]) {
				foundCorrespondance = true;
				break;
			}
		}
		if (!foundCorrespondance) {
			ofstream o;
			o.open("log_checkVoxelNodesUpToDate.txt");
			o << "Voxel Node [" << p[0] << " " << p[1] << " " << p[2] << "] with component number " << voxelNodeCompID << " has no correspondance in Graph Nodes!\n";
			o.close();
			return false;
		}
	}

	// check if every Graph Node coprresponds to some VoxelNode
	for (auto inode = Nodes.begin(); inode != Nodes.end(); inode++) {
		for (auto ivn = inode->voxelNodes.begin(); ivn != inode->voxelNodes.end(); ivn++) {
			auto voxelNodeCompID = thinner->getVoxelNodeComponentID((*ivn)[0], (*ivn)[1], (*ivn)[2]);
			if (voxelNodeCompID != inode->ID) {
				ofstream o;
				o.open("log_checkVoxelNodesUpToDate.txt");
				o << "Graph Node has wrong representation in thinner:\n";
				printNode(o, *inode);
				o << "\nvoxel node component ID = " << voxelNodeCompID << endl;
				o.close();
				return false;
			}
		}

	}



	return true;
}


bool Graph::LastRemovedRibIsTerminal() {
	assert(RemovedNodeStack.size() > 0);

	auto nodePair = *(RemovedNodeStack.end() - 1);
	auto nodeToRestore1 = nodePair.first;
	auto nodeToRestore2 = nodePair.second;
	if (nodeToRestore1.degree == 1 || nodeToRestore2.degree == 1)
		return true;
	return false;
}

void Graph::UndoRemoveRib() {
	//assert(ribID < Ribs.size());
	//assert(ribID >= 0);
#ifdef PRINT_LOGS_GRAPH
	ofstream o;
	o.open("log_undo.txt");
	o << "RemovedNodeStack.size() = " << RemovedNodeStack.size() << endl;
#endif //PRINT_LOGS_GRAPH

	// pop node pair from removeNode Stack

	auto nodePair = *(RemovedNodeStack.end() - 1);
	RemovedNodeStack.erase(RemovedNodeStack.end() - 1);
	auto nodeToRestore1 = nodePair.first;

#ifdef PRINT_LOGS_GRAPH
	o << "nodepair first:\n";
	printNode(o, nodeToRestore1);
#endif //PRINT_LOGS_GRAPH

	auto nodeToRestore2 = nodePair.second;

#ifdef PRINT_LOGS_GRAPH
	o << "nodepair second:\n";
	printNode(o, nodeToRestore2);

	o << "RemovedRibStack.size() = " << RemovedRibStack.size() << endl;
#endif //PRINT_LOGS_GRAPH

	auto ribToRestore = *(RemovedRibStack.end() - 1);
	RemovedRibStack.erase(RemovedRibStack.end() - 1);
	RedoRibStack.push_back(ribToRestore);

#ifdef PRINT_LOGS_GRAPH
	o << "rib to restore:\n";
	printRib(o, ribToRestore, 0);
#endif //PRINT_LOGS_GRAPH

	// update VoxelNode indices in thinner->Z
	bool node2ID_greater_ThanNode1ID = (nodeToRestore2.ID > nodeToRestore1.ID && !nodeToRestore1.isNullNode);

#ifdef PRINT_LOGS_GRAPH
	o << "node2ID_greater_ThanNode1ID = " << node2ID_greater_ThanNode1ID << endl;
#endif //PRINT_LOGS_GRAPH

	if (!nodeToRestore2.isNullNode || !nodeToRestore1.isNullNode) // update if at least one of the nodes was removed
#ifdef PRINT_LOGS_GRAPH
		o << "!nodeToRestore2.isNullNode || !nodeToRestore1.isNullNode PASSED!\n";
#endif //PRINT_LOGS_GRAPH
	for (auto ivn = thinner->VoxelNodes.begin(); ivn != thinner->VoxelNodes.end(); ++ivn) {
		int x = (*ivn)[0];
		int y = (*ivn)[1];
		int z = (*ivn)[2];

		int currentID = thinner->getVoxelNodeComponentID(x, y, z);

		if (!nodeToRestore2.isNullNode) {
			if (currentID >= nodeToRestore2.ID + (node2ID_greater_ThanNode1ID ? -1 : 0)) {
				thinner->Z[thinner->getIndex(x, y, z)] += 1;
			}
		}
		if (!nodeToRestore1.isNullNode) {
			if (currentID >= nodeToRestore1.ID) {
				thinner->Z[thinner->getIndex(x, y, z)] += 1;
			}
		}
	}

	// restore VoxelNodes enumeration for removed nodes
#ifdef PRINT_LOGS_GRAPH
	o << endl << "SETTING NODE 1 voxels";
#endif //PRINT_LOGS_GRAPH
	if (!nodeToRestore1.isNullNode)
		for (auto coord = nodeToRestore1.voxelNodes.begin(); coord != nodeToRestore1.voxelNodes.end(); coord++) {
#ifdef PRINT_LOGS_GRAPH
			o << "Z[" << (*coord)[0] << ", " << (*coord)[1] << ", " << (*coord)[2] << "] is set to " << nodeToRestore1.ID + 4 << endl;
#endif //PRINT_LOGS_GRAPH
			thinner->Z[thinner->getIndex((*coord)[0], (*coord)[1], (*coord)[2])] = nodeToRestore1.ID + 4;
			thinner->VoxelNodes.push_back(*coord);
		}
#ifdef PRINT_LOGS_GRAPH
	o << endl << "SETTING NODE 2 voxels";
#endif //PRINT_LOGS_GRAPH

	if (!nodeToRestore2.isNullNode)
		for (auto coord = nodeToRestore2.voxelNodes.begin(); coord != nodeToRestore2.voxelNodes.end(); coord++) {
#ifdef PRINT_LOGS_GRAPH
			o << "Z[" << (*coord)[0] << ", " << (*coord)[1] << ", " << (*coord)[2] << "] is set to " << nodeToRestore2.ID + 4 << endl;
#endif //PRINT_LOGS_GRAPH
			thinner->Z[thinner->getIndex((*coord)[0], (*coord)[1], (*coord)[2])] = nodeToRestore2.ID + 4;
			thinner->VoxelNodes.push_back(*coord);
		}
#ifdef PRINT_LOGS_GRAPH
	o << endl;
#endif //PRINT_LOGS_GRAPH

	// restore node 2 if necessary
	int node2ID = nodeToRestore2.ID + (node2ID_greater_ThanNode1ID ? -1 : 0);
#ifdef PRINT_LOGS_GRAPH
	o << "node2ID = " << node2ID << endl;
#endif //PRINT_LOGS_GRAPH
	if (!nodeToRestore2.isNullNode) {
#ifdef PRINT_LOGS_GRAPH
		o << "RESTORING NODE 2\n";
		o << "updating rib ends IDS: Node 2\n";
#endif //PRINT_LOGS_GRAPH
		for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++) {
			if (irib->firstEndID >= node2ID)
				irib->firstEndID += 1;
			if (irib->secondEndID >= node2ID)
				irib->secondEndID += 1;
		}
#ifdef PRINT_LOGS_GRAPH
		o << "updating node IDS: Node 2\n";
#endif //PRINT_LOGS_GRAPH
		for (auto inode = Nodes.begin() + node2ID; inode != Nodes.end(); inode++) {
			inode->ID += 1;
		}

		// check if node2ID > node1ID. If so node2 index is need to be decremented
#ifdef PRINT_LOGS_GRAPH
		o << "inserting Node 2\n";
#endif //PRINT_LOGS_GRAPH
		Nodes.insert(Nodes.begin() + node2ID, nodeToRestore2);
	}


	// restore node 1 if necessary
	if (!nodeToRestore1.isNullNode) {
#ifdef PRINT_LOGS_GRAPH
		o << "RESTORING NODE 1\n";
		o << "updating rib ends IDS: Node 1\n";
#endif //PRINT_LOGS_GRAPH
		// update rib ends
		for (auto irib = Ribs.begin(); irib != Ribs.end(); irib++) {
			if (irib->firstEndID >= nodeToRestore1.ID)
				irib->firstEndID += 1;
			if (irib->secondEndID >= nodeToRestore1.ID)
				irib->secondEndID += 1;
		}

#ifdef PRINT_LOGS_GRAPH
		o << "updating node IDS: Node 1\n";
#endif //PRINT_LOGS_GRAPH
		//update following node ids
		for (auto inode = Nodes.begin() + nodeToRestore1.ID; inode != Nodes.end(); inode++) {
			if (!nodeToRestore2.isNullNode && inode->ID == node2ID) {
#ifdef PRINT_LOGS_GRAPH
				o << "continue on inserted node 2!\n";
#endif //PRINT_LOGS_GRAPH
				continue;
			}// we inserted original node 2
			inode->ID += 1;
		}

#ifdef PRINT_LOGS_GRAPH
		o << "inserting Node 1\n";
#endif //PRINT_LOGS_GRAPH
		// restore node
		Nodes.insert(Nodes.begin() + nodeToRestore1.ID, nodeToRestore1);
	}


#ifdef PRINT_LOGS_GRAPH
	o << "\nupdating indices of incident ribs\n";
#endif //PRINT_LOGS_GRAPH
	// update indices of incident ribs
	for (auto inode = Nodes.begin(); inode != Nodes.end(); inode++) {
		if ((inode->ID == nodeToRestore1.ID && !nodeToRestore1.isNullNode)
			|| (inode->ID == nodeToRestore2.ID && !nodeToRestore2.isNullNode)) // do not modify original nodes!
		{
#ifdef PRINT_LOGS_GRAPH
			o << "continue on inserted nodes 1 and 2!\n";
#endif //PRINT_LOGS_GRAPH
			continue;
		}
		for (auto irib = inode->incidentRibsID.begin(); irib != inode->incidentRibsID.end(); irib++) {
			if ((*irib) >= ribToRestore.ID) {
				(*irib) += 1;
			}
		}
	}

#ifdef PRINT_LOGS_GRAPH
	o << "\n update indices of Ribs\n";
#endif //PRINT_LOGS_GRAPH
	// update indices of Ribs
	for (int i = ribToRestore.ID; i < Ribs.size(); i++)
		Ribs[i].ID += 1;

#ifdef PRINT_LOGS_GRAPH
	o << "RESTORING RIB\n";
#endif //PRINT_LOGS_GRAPH
	// restore rib
	Ribs.insert(Ribs.begin() + ribToRestore.ID, ribToRestore);

	if (nodeToRestore1.isNullNode) {
#ifdef PRINT_LOGS_GRAPH
		o << "\n increment degree on node 1\n";
#endif //PRINT_LOGS_GRAPH
		Nodes[ribToRestore.firstEndID].degree++;
#ifdef PRINT_LOGS_GRAPH
		o << "pushing incident rib on node 1\n";
#endif //PRINT_LOGS_GRAPH
		Nodes[ribToRestore.firstEndID].incidentRibsID.push_back(ribToRestore.ID);
	}
	if (nodeToRestore2.isNullNode) {
#ifdef PRINT_LOGS_GRAPH
		o << "\n increment degree on node 2\n";
#endif //PRINT_LOGS_GRAPH
		Nodes[ribToRestore.secondEndID].degree++;
#ifdef PRINT_LOGS_GRAPH
		o << "pushing incident rib on node 2\n";
#endif //PRINT_LOGS_GRAPH
		Nodes[ribToRestore.secondEndID].incidentRibsID.push_back(ribToRestore.ID);
	}
#ifdef PRINT_LOGS_GRAPH
	o << "Ribs size = " << Ribs.size() << endl;
	o << "Nodes size = " << Nodes.size() << endl;
	o << "PRINT GRAPH:\n";
	printGraph(o);
	o.close();
#endif //PRINT_LOGS_GRAPH

}


void Graph::UndoRemoveGaps() {
#ifdef PRINT_LOGS_GRAPH
	ofstream o;
	o.open("log_undoRemoveGaps.txt");

	o << "GapRibsStack.size() = " << GapRibsStack.size() << endl;
#endif //PRINT_LOGS_GRAPH
	auto removedRibs = *(GapRibsStack.end() - 1);
#ifdef PRINT_LOGS_GRAPH
	o << "removedRibs.size() = " << removedRibs.size() << endl;
	o << "BEGIN OF removedRibs: \n";
	for (auto it = removedRibs.begin(); it != removedRibs.end(); it++) {
		printRib(o, (*it), 0);
	}
	o << "END OF removedRibs\n\n";
#endif //PRINT_LOGS_GRAPH
	GapRibsStack.erase(GapRibsStack.end() - 1);
#ifdef PRINT_LOGS_GRAPH
	o << "GapNodesStack.size() = " << GapNodesStack.size() << endl;
#endif //PRINT_LOGS_GRAPH
	auto removedNodes = *(GapNodesStack.end() - 1);
#ifdef PRINT_LOGS_GRAPH
	o << "removedNodes.size() = " << removedNodes.size() << endl;
	o << "BEGIN OF removedNodes: \n";
	for (auto it = removedNodes.begin(); it != removedNodes.end(); it++) {
		printNode(o, (*it));
	}
	o << "END OF removedNodes\n\n";
#endif //PRINT_LOGS_GRAPH
	GapNodesStack.erase(GapNodesStack.end() - 1);

	auto size = removedRibs.size();

#ifdef PRINT_LOGS_GRAPH
	o << "STARTING FOR LOOP\n\n";
#endif //PRINT_LOGS_GRAPH
	for (int i = 0; i < size; i++) {
#ifdef PRINT_LOGS_GRAPH
		o << "iter = " << i << " of " << size << endl;
#endif //PRINT_LOGS_GRAPH
		auto rib = *(removedRibs.end() - 1);
		removedRibs.erase(removedRibs.end() - 1);
#ifdef PRINT_LOGS_GRAPH
		o << "GAP RIB:\n";
		printRib(o, rib, 0);
		o << "ERASING RIB\n";
		o << "Ribs.size(): " << Ribs.size() << " -> ";
#endif //PRINT_LOGS_GRAPH

		Ribs.erase(Ribs.begin() + rib.ID); // remove gap rib

#ifdef PRINT_LOGS_GRAPH
		o << Ribs.size() << "\n";
		o << "decrement Nodes[" << rib.secondEndID << "] degree:" << Nodes[rib.secondEndID].degree << " -> ";
#endif //PRINT_LOGS_GRAPH
		Nodes[rib.secondEndID].degree--; // decrease gap rib degree and wrapper
#ifdef PRINT_LOGS_GRAPH
		o << Nodes[rib.secondEndID].degree << "\n";

		o << "removing incident rib. Node.incidentRibsID: [";
		for (auto it = Nodes[rib.secondEndID].incidentRibsID.begin(); it != Nodes[rib.secondEndID].incidentRibsID.end(); it++)
			o << *it << " ";
		o << "] -> [";

#endif //PRINT_LOGS_GRAPH		
		for (auto it = Nodes[rib.secondEndID].incidentRibsID.begin(); it != Nodes[rib.secondEndID].incidentRibsID.end(); it++) {
			if (*it == rib.ID) {
				Nodes[rib.secondEndID].incidentRibsID.erase(it);
				break;
			}
		}
#ifdef PRINT_LOGS_GRAPH
		for (auto it = Nodes[rib.secondEndID].incidentRibsID.begin(); it != Nodes[rib.secondEndID].incidentRibsID.end(); it++)
			o << *it << " ";
		o << "\n\n";

#endif //PRINT_LOGS_GRAPH		

		auto node = *(removedNodes.end() - 1);
		removedNodes.erase(removedNodes.end() - 1);
#ifdef PRINT_LOGS_GRAPH
		o << "NODE FROM removedNodes (firstEnd that is projection on graph):\n";
		printNode(o, node);

		o << "Decreasing degree: Nodes[" << rib.firstEndID << "].degree : " << Nodes[rib.firstEndID].degree << " -> " << Nodes[rib.firstEndID].degree - 1 << endl;
#endif //PRINT_LOGS_GRAPH		

		// decrease degree 
		Nodes[rib.firstEndID].degree--;
		// remove the rib ID from the node incidence
#ifdef PRINT_LOGS_GRAPH
		o << "REMOVING RIB ID FROM NODE INCIDENCE:\n[";
		for (auto it = Nodes[rib.firstEndID].incidentRibsID.begin(); it != Nodes[rib.firstEndID].incidentRibsID.end(); it++)
			o << *it << " ";
		o << "] -> [";
#endif //PRINT_LOGS_GRAPH		
		for (auto it = Nodes[rib.firstEndID].incidentRibsID.begin(); it != Nodes[rib.firstEndID].incidentRibsID.end(); it++) {
			if (*it == rib.ID) {
				Nodes[rib.firstEndID].incidentRibsID.erase(it);
				break;
			}
		}

#ifdef PRINT_LOGS_GRAPH
		for (auto it = Nodes[rib.firstEndID].incidentRibsID.begin(); it != Nodes[rib.firstEndID].incidentRibsID.end(); it++)
			o << *it << " ";
		o << "] \n";
#endif //PRINT_LOGS_GRAPH
		if (!node.isNullNode) { // undo rib cut

#ifdef PRINT_LOGS_GRAPH
			o << "\nREMOVING NODE WAS ADDED DURING THE RIB CUT";
#endif //PRINT_LOGS_GRAPH
			auto cutNode = Nodes[rib.firstEndID];
			Nodes.erase(Nodes.begin() + rib.firstEndID);

#ifdef PRINT_LOGS_GRAPH
			o << "CUT NODE:\n";
			printNode(o, cutNode);
#endif //PRINT_LOGS_GRAPH

			// remove cutNode info from thinner 
			thinner->Z[thinner->getIndex(cutNode.voxelNodes[0][0], cutNode.voxelNodes[0][1], cutNode.voxelNodes[0][2])] = 1;
			for (auto it = thinner->VoxelNodes.begin(); it != thinner->VoxelNodes.end(); ) {
				if ((*it)[0] == cutNode.voxelNodes[0][0] &&
					(*it)[1] == cutNode.voxelNodes[0][1] &&
					(*it)[2] == cutNode.voxelNodes[0][2])
					thinner->VoxelNodes.erase(it);
				else
					it++;
			}

			// remove rib with the larger index
			assert(cutNode.incidentRibsID.size() == 2);
			int ribID1 = cutNode.incidentRibsID[0];
			int ribID2 = cutNode.incidentRibsID[1];

			int maxRibID = (ribID1 > ribID2 ? ribID1 : ribID2);
			int minRibID = (ribID1 > ribID2 ? ribID2 : ribID1);
#ifdef PRINT_LOGS_GRAPH
			o << "minRibID = " << minRibID << ", maxRibID = " << maxRibID << "\n";
			o << "REMOVING MAX RIB\n";
#endif //PRINT_LOGS_GRAPH


			// we delete maxRibID and replace incidence info with minRibID
			auto maxRib = Ribs[maxRibID];
			Ribs.erase(Ribs.begin() + maxRibID);
			// здесь не нужно перезаписывать маркеры

#ifdef PRINT_LOGS_GRAPH
			o << "\nPOINTS OF RECOVERED RIB:\n";
			for (auto ipoint = Ribs[minRibID].points.begin(); ipoint != Ribs[minRibID].points.end(); ipoint++)
				o << "     " << (*ipoint)[0] << " " << (*ipoint)[1] << " " << (*ipoint)[2] << "\n ";
			o << "++++++++\n";
			for (auto ipoint = maxRib.points.begin() + 1; ipoint != maxRib.points.end(); ipoint++)
				o << "     " << (*ipoint)[0] << " " << (*ipoint)[1] << " " << (*ipoint)[2] << "\n ";
#endif //PRINT_LOGS_GRAPH

			// gathering all points of cut rib and storring them in the old one 
			for (auto ipoint = maxRib.points.begin() + 1; ipoint != maxRib.points.end(); ipoint++)
				Ribs[minRibID].points.push_back(*ipoint);

			// revert incidence 
#ifdef PRINT_LOGS_GRAPH
			o << "\nRibs[minRibID].secondEndID: " << Ribs[minRibID].secondEndID << " -> " << maxRib.secondEndID << endl;
#endif //PRINT_LOGS_GRAPH
			Ribs[minRibID].secondEndID = maxRib.secondEndID;

#ifdef PRINT_LOGS_GRAPH
			o << "\nNodes[maxRib.secondEndID] inciden ribs: [";
			for (auto i = 0; i < Nodes[maxRib.secondEndID].incidentRibsID.size(); i++)
				o << Nodes[maxRib.secondEndID].incidentRibsID[i] << " ";
			o << "] -> [";
#endif //PRINT_LOGS_GRAPH
			for (auto i = 0; i < Nodes[maxRib.secondEndID].incidentRibsID.size(); i++)
				if (Nodes[maxRib.secondEndID].incidentRibsID[i] == maxRibID) {
					Nodes[maxRib.secondEndID].incidentRibsID[i] = minRibID;
					break;
				}
#ifdef PRINT_LOGS_GRAPH
			for (auto i = 0; i < Nodes[maxRib.secondEndID].incidentRibsID.size(); i++)
				o << Nodes[maxRib.secondEndID].incidentRibsID[i] << " ";
			o << "]\n";
			o << "END OF ITERATION\n\n\n";
#endif //PRINT_LOGS_GRAPH

		}
	}
	wrapGraph();
}

bool Graph::LastRedoRibIsTerminal() {
	assert(RedoRibStack.size() > 0);
	auto rib = *(RedoRibStack.end() - 1);
	if (Nodes[rib.firstEndID].degree == 1 || Nodes[rib.secondEndID].degree == 1)
		return true;
	return false;
}
