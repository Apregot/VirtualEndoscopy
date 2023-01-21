// CubeWithoutHeadersSample.cpp : Defines the exported functions for the DLL application.
//

#include "stdafx.h"
#include "vtb.hpp"
#include <exception>

#include <sstream>
#include <iterator>

#include <math.h>
#include "Headers/utils.h"

#include "configuration.h"
#include "Headers/hessian_filters.hpp"
#include "tracer.h"
#include "mvox.h"

Tracer tracer;  // да, глобальная переменная

#pragma warning( disable : 4297 4996 )

typedef void(*FFRTextWriter)(wchar_t* text);

class FFRProcessor {
public:
    FFRProcessor(FFRSettings settings) {

        this->_settings = settings;
        /*
        ofstream o("ffr_initialize_log.txt");
        o << "settings.AortaAverageIntensity = " << settings.AortaAverageIntensity << std::endl;
        o << "settings.AortaInitialPoint = " << settings.AortaInitialPoint.x << " " << settings.AortaInitialPoint.y << std::endl;
        o << "settings.AortaRadius = " << settings.AortaRadius << std::endl;
        o << "settings.aortaThreshold = " << settings.aortaThreshold << std::endl;
        o << "settings.frangiThreshold = " << settings.frangiThreshold << std::endl;
        o << "settings.idtStopParameter = " << settings.idtStopParameter << std::endl;
        o << "settings.maxNoiseLength = " << settings.maxNoiseLength << std::endl;
        o << "settings.minDistBetweenOstia = " << settings.minDistBetweenOstia << std::endl;
        o << "settings.minNumOfVoxelsInBranch = " << settings.minNumOfVoxelsInBranch << std::endl;
        o.close();
        */
        this->vtb = new VTB();

        this->vtb->parameters->frangiThreshold = 70;
        this->vtb->parameters->idtStopParameter = 0.008;
        this->vtb->parameters->aortaThreshold = 150;
        this->vtb->parameters->minDistBetweenOstia = 50;
        this->vtb->parameters->minNumOfVoxelsInBranch = 1000;
        this->vtb->parameters->maxNoiseLength = 5;
        this->vtb->parameters->frangi_c = 500;
        this->vtb->parameters->frangi_alpha = 0.5;
        this->vtb->parameters->frangi_beta = 0.5;
        this->vtb->parameters->ostiumSearchThickness = 5;

        this->cursor = 0;
    }

    ~FFRProcessor() {
        if (this->vtb != nullptr) {
            delete vtb;
            vtb = nullptr;
        }
    }

    void initializeMatrices(mvox::Cube sourceDataCube) {
        this->imageToSpace = sourceDataCube.ImageToSpace;
        this->spaceToImage = sourceDataCube.SpaceToImage;
    }


    void segmAorta(mvox::Cube sourceDataCube) {
        initializeMatrices(sourceDataCube);
        auto origin = mvox::Point3D_Double(0, 0, 0) * imageToSpace;

        vtb->origin[0] = origin.x;
        vtb->origin[1] = origin.y;
        vtb->origin[2] = origin.z;

        auto aorta_image_point = _settings.AortaInitialPoint * this->spaceToImage;
        unsigned long long ax = floor(aorta_image_point.x);
        unsigned long long ay = floor(aorta_image_point.y);
        unsigned long long az = floor(aorta_image_point.z);
        unsigned long long aorta_index = ax + (unsigned long long) (sourceDataCube.width) * (ay +
            (unsigned long long) (sourceDataCube.height) * az);

        short* CubeData = (short*)sourceDataCube.Data;

        ofstream o;
        o.open("log_dataInfo.txt");
        o << "Dims = [" << sourceDataCube.width << ", "
            << sourceDataCube.height << ", "
            << sourceDataCube.depth << "]\n";
        o << "Spacing = [" << sourceDataCube.scaleX << ", "
            << sourceDataCube.scaleY << ", "
            << sourceDataCube.scaleZ << "]\n";
        o.close();

        this->vtb->initializeImageWithPulmonaryRemoval(CubeData,
            sourceDataCube.width,
            sourceDataCube.height,
            sourceDataCube.depth,
            sourceDataCube.scaleX,
            sourceDataCube.scaleY,
            sourceDataCube.scaleZ,
            aorta_index);


        /*
        // THIS TEST WORKS ONLY FOR CASE 1 PERFECT
        // TERMINAL PATH WRITTEN TO test_terminalPath is required
        ofstream oo("log_check_read.txt");
        oo << "open file" << endl;
        ifstream in("test_terminalPath2.txt");
        int pointCount;
        vector<vector<double> > cnt;
        vector<int> pnt_i(3);
        vector<double> pnt(3);
        in >> pointCount;
        oo << "pointCount = " << pointCount << endl;

        for (int i = 0; i < pointCount; i++) {
            oo << i << endl;
            in >> pnt_i[0] >> pnt_i[1] >> pnt_i[2];
            oo << pnt_i[0] << " " << pnt_i[1] << " " << pnt_i[2] << endl;
            pnt[0] = sourceDataCube.scaleX * (0.5 + (double)(pnt_i[0] - 1));
            pnt[1] = sourceDataCube.scaleY * (0.5 + (double)(pnt_i[1] - 1));
            pnt[2] = sourceDataCube.scaleZ * (0.5 + (double)(pnt_i[2] - 1));
            oo << pnt[0] << " " << pnt[1] << " " << pnt[2] << endl;

            cnt.push_back(pnt);
        }
        in.close();
        oo << "done" << endl;
        oo << "generate spline" << endl;
        unsigned range[2] = { 1,7 };
        Utils::bSplineApproxMulti* spline = new Utils::bSplineApproxMulti(range, cnt);
        spline->WriteSplineToPythonFile();

        oo << "generate spline -- done" << endl;
        oo << "get natural parametrization" << endl;

        auto curve = spline->getNaturalCurveWithFreneFrames();

        oo << "write min rotation frames" << endl;
        spline->WriteMinRotationFramesToPythonFile();
        oo << "write min rotation frames -- done" << endl;

        oo << "get natural parametrization -- done" << endl;
        oo << "get crossSection" << endl;


        int halfSize = 50;
        int size[2] = { (2 * halfSize + 1) , (2 * halfSize + 1) };
        unsigned long long usize[2] = { (2 * halfSize + 1) , (2 * halfSize + 1) };

        short* crossSections = new short[(halfSize * 2 + 1) * (halfSize * 2 + 1) * curve->numberOfPoints];
        double cs_spacing[2] = { this->vtb->vsize[0] / 2, this->vtb->vsize[1] / 2 };
        //double* Circleness;
        //short* sCircleness;
        for (int pointNumber = 0; pointNumber < curve->numberOfPoints; pointNumber++) {
            short* crossSection = crossSections + size[0] * size[1] * pointNumber;
            this->vtb->getCrossSection(crossSection,
                                            halfSize,
                                            curve->minFrames[pointNumber].f,
                                            curve->minFrames[pointNumber].g,
                                            curve->points[pointNumber], cs_spacing, "");

            oo << "get crossSection " << pointNumber << " -- done" << endl;
            oo << "print crossSection" << endl;

            oo << "print crossSection -- done" << endl;

        }

        short* longitudalSlice = new short[size[0] * curve->numberOfPoints];

        int l_size[2] = { size[0], curve->numberOfPoints };
        for (int y = 0; y < l_size[0]; y++) {
            for (int z = 0; z < l_size[1]; z++) {
                longitudalSlice[y + l_size[0] * z] = crossSections[halfSize + size[0] * (y + size[1] * z)];
            }
        }

        short* toPrint = new short[l_size[0] * l_size[1]];
        for (size_t i = 0; i < l_size[0] * l_size[1]; i++)
            toPrint[i] = longitudalSlice[i];
        auto contour = Utils::getVesselContour(longitudalSlice, l_size, cs_spacing, 1, 50);
        for (int i = 0; i < l_size[1]; i++) {
            toPrint[contour[i][0] + size[0] * i] = -1000;
            toPrint[contour[i][1] + size[0] * i] = -1000;
        }
        Utils::printSliceOnPng("cross-sections\\yz_contour_A1_C50.png",
                                       toPrint, l_size, cs_spacing);



        Utils::printSliceOnPng("cross-sections\\yz_longitudal_slice.png",
                                   longitudalSlice, l_size, cs_spacing);

        for (int x = 0; x < l_size[0]; x++) {
            for (int z = 0; z < l_size[1]; z++) {
                longitudalSlice[x + l_size[0] * z] = crossSections[x + size[0] * (halfSize + size[1] * z)];
            }
        }

        for (size_t i = 0; i < l_size[0] * l_size[1]; i++)
            toPrint[i] = longitudalSlice[i];
        contour = Utils::getVesselContour(longitudalSlice, l_size, cs_spacing, 1, 50);
        for (int i = 0; i < l_size[1]; i++) {
            toPrint[contour[i][0] + size[0] * i] = -1000;
            toPrint[contour[i][1] + size[0] * i] = -1000;
        }
        //Utils::printSliceOnPng("cross-sections\\contour_A_" + to_string(A) + "_C_" + to_string(C) + ".png",
        Utils::printSliceOnPng("cross-sections\\xz_contour_A1_C50.png",
                                       toPrint, l_size, cs_spacing);


        Utils::printSliceOnPng("cross-sections\\xz_longitudal_slice.png",
                                   longitudalSlice, l_size, cs_spacing);


        delete[] toPrint;

        delete[]longitudalSlice;
        delete[]crossSections;
        oo.close();


        exit(0);
        */


        this->vtb->aortaCenterOnFirstSlice[0] = ax;
        this->vtb->aortaCenterOnFirstSlice[1] = ay;
        this->vtb->aortaCenterOnFirstSlice[2] = az;
        this->vtb->aortaRadiusOnFirstSlice = _settings.AortaRadius;
#ifndef CEREBRAL_VESSELS
#ifndef SKIP_AORTA
        this->vtb->preprocessAorta();
#endif // SKIP_AORTA
#endif //CEREBRAL_VESSELS
    }


    void initializeVesselness(mvox::Cube sourceDataCube,
        double newAlpha,
        double newBeta,
        double newC) {
        this->vtb->parameters->frangi_alpha = newAlpha;
        this->vtb->parameters->frangi_beta = newBeta;
        this->vtb->parameters->frangi_c = newC;
        this->vtb->preprocessVesselness();
    }

    void MarkVessels(mvox::Cube segmCube, uint8_t targetCode, int vesselObjectIndex) {
        if (segmCube.Format != mvox::PixelFormat::Y)
            throw std::runtime_error("Cube must be Y format");

        short* ptrV = this->vtb->vesselComponents;

        //short* ptrV = this->vtb->nonvesselnessMask;
        if (this->vtb->vesselComponents) {
            if (vesselObjectIndex < 2) {
                for (int z = 0; z < segmCube.depth; ++z) {
                    auto slice = segmCube.GetSlice<uint8_t>(z);
                    for (int y = 0; y < segmCube.height; ++y) {
                        auto line = &slice[y * segmCube.width];
                        for (int x = 0; x < segmCube.width; ++x)
                            if (ptrV[x + segmCube.width * (y + segmCube.height * z)] == vesselObjectIndex + 1)
                                //if (ptrV[x + segmCube.width*(y + segmCube.height*z)]>0)
                                line[x] = targetCode;
                    }
                }
            } else {
                ofstream ofs;
                ofs.open("log_markVessels.txt");
                //				//{
                if (vtb->userMarkedVessels.size() > 0) {
                    for (auto i = vtb->userMarkedVessels[0].begin(); i != vtb->userMarkedVessels[0].end(); i++)
                        ofs << (*i) << " " << vtb->vesselComponents[(*i)] << std::endl;
                }
                ofs.close();

                // user set components
                for (int z = 0; z < segmCube.depth; ++z) {
                    auto slice = segmCube.GetSlice<uint8_t>(z);
                    for (int y = 0; y < segmCube.height; ++y) {
                        auto line = &slice[y * segmCube.width];
                        for (int x = 0; x < segmCube.width; ++x)
                            if (ptrV[x + segmCube.width * (y + segmCube.height * z)] > 2) {
                                line[x] = targetCode;
                            }
                    }
                }
            }
        }
    }


    void MarkAorta(mvox::Cube segmCube, uint8_t targetCode) {
        if (!this->vtb->aortaMask)
            return;
        if (segmCube.Format != mvox::PixelFormat::Y)
            throw std::runtime_error("Cube must be Y format");
        for (int z = 0; z < segmCube.depth; ++z) {
            auto slice = segmCube.GetSlice<uint8_t>(z);
            for (int y = 0; y < segmCube.height; ++y) {
                auto line = &slice[y * segmCube.width];
                for (int x = 0; x < segmCube.width; ++x)
                    if (this->vtb->aortaMask[x + segmCube.width * (y + segmCube.height * z)])
                        //if (this->vtb->nonvesselnessMask[x + segmCube.width*(y + segmCube.height*z)])
                        line[x] = targetCode;
            }
        }
    }

    int GetVesselsCount() {
        return this->vtb->graph->numOfTerminalPaths;
    }

    std::vector<mvox::Point3D_Double> GetVesselBiffurcations(int vesselIndex) {
        auto res = std::vector<mvox::Point3D_Double>();
        std::vector <std::vector<int> > bifurs;

        if (vtb->graph->terminalPathLabels[vesselIndex])
            bifurs = this->vtb->graph->NodesOnTerminalPaths[vesselIndex];
        for (int i = 0; i < bifurs.size(); ++i) {
            // thinner got additional voxel layer, so every thinner coordinate must be decremented
            auto point = mvox::Point3D_Double(bifurs[i][0] - 1, bifurs[i][1] - 1, bifurs[i][2] - 1) * imageToSpace;
            res.push_back(point);
        }

        return res;

    }

    std::vector<mvox::Point3D_Double> GetVesselCenterLine(int vesselIndex) {
        ofstream o;
        bool print = false;
        if ((vesselIndex + 1 - this->vtb->graph->numOfLeftTerminalPaths) == 2) {
            print = 1;
            o.open("log_GetVesselInfo.txt");
            o << "vessel_index " << vesselIndex << endl;
        }
        auto res = std::vector<mvox::Point3D_Double>();

        auto path = this->vtb->graph->TerminalPaths[vesselIndex];
        if (print)
            o << "points\n";
        for (int i = 0; i < path.size(); ++i) {
            // thinner got additional voxel layer, so every thinner coordinate must be decremented
            auto point = mvox::Point3D_Double(path[i][0] - 1, path[i][1] - 1, path[i][2] - 1) * imageToSpace;
            if (print)
                o << "    " << i << ": [" << path[i][0] << ", " << path[i][1] << ", " << path[i][2] << "] -> [" << point.x << ", " << point.y << ", " << point.z << "]\n";

            res.push_back(point);
        }
        if (print)
            o.close();
        return res;
    }

    VesselInfo GetVesselInfo(int vesselIndex) {
        ofstream o;
        bool print = false;
        if ((vesselIndex + 1 - this->vtb->graph->numOfLeftTerminalPaths) == 2) {
            print = 1;
            o.open("log_GetVesselInfo.txt");
            o << "vessel_index " << vesselIndex << endl;
        }
        if (vesselIndex >= this->vtb->graph->numOfTerminalPaths)
            throw std::runtime_error("Vessel index is out of range");

        std::wostringstream ss;
        VesselInfo info;


        if (this->vtb->graph->terminalPathLabels[vesselIndex] == 1) {
            //TODO сделать номральную нумерацию
            if (print)
                o << "Left vessel " << (vesselIndex + 1) << endl;
            ss << L"Left vessel: " << (vesselIndex + 1) << std::endl;
        } else if (this->vtb->graph->terminalPathLabels[vesselIndex] == 2) {
            if (print)
                o << "Right vessel " << vesselIndex + 1 - this->vtb->graph->numOfLeftTerminalPaths << endl;
            ss << L"Right vessel: " << (vesselIndex + 1 - this->vtb->graph->numOfLeftTerminalPaths) << std::endl;
        } else {
            if (print)
                o << "unadopted vessel " << vesselIndex + 1 << endl;
            ss << L"unadopted vessel: " << (vesselIndex + 1) << std::endl;
        }
        if (print)
            o << "CenterLineCount " << this->vtb->graph->TerminalPaths[vesselIndex].size() << endl;
        info.CenterLineCount = this->vtb->graph->TerminalPaths[vesselIndex].size();
        if (print)
            o << "BifurcationCount " << this->vtb->graph->NodesOnTerminalPaths[vesselIndex].size() << endl;
        info.BifurcationCount = this->vtb->graph->NodesOnTerminalPaths[vesselIndex].size();

        info.VesselName = ss.str();

        if (print)
            o.close();
        return info;
    }


    // NEW CODE FOR VEINS DELETION

    void SetCursor(int c) {
        this->cursor = c;
    }

    int GetCursor() {
        return cursor;
    }

    ///идея простая, если мы смогли удалить вену, то курсор перемещается вперед
    ///и заберется новый граф сосуда
    ///если мы тыкнули, а удалить вены не удалось, то курсор возвращается прежний,
    ///то есть типа граф не изменился
    int DeleteVein(mvox::Point3D_Double point) {
        ofstream o;
        o.open("log_DeleteVein.txt");

        auto imagePoint = point * spaceToImage;


        // search for the nearest rib
        int ribToRemoveID;
        double minDist = 1e+20;
        double dist;
        for (auto irib = vtb->graph->Ribs.begin(); irib != vtb->graph->Ribs.end(); irib++) {
            for (auto ipoint = irib->points.begin(); ipoint != irib->points.end(); ipoint++) {
                dist = sqrt((imagePoint.x - (*ipoint)[0]) * (imagePoint.x - (*ipoint)[0])
                           + (imagePoint.y - (*ipoint)[1]) * (imagePoint.y - (*ipoint)[1])
                           + (imagePoint.z - (*ipoint)[2]) * (imagePoint.z - (*ipoint)[2]));
                if (dist < minDist) {
                    minDist = dist;
                    ribToRemoveID = irib->ID;
                }
            }
        }


        o << "ribToRemoveID = " << ribToRemoveID << endl;
        o << "minDist = " << minDist << endl;

        o << "PRINTING RIB:\n ";
        vtb->graph->printRib(o, vtb->graph->Ribs[ribToRemoveID], 1);

        o << "\nimagePoint = [" << imagePoint.x << " " << imagePoint.y << " " << imagePoint.z << "]\n";

        this->vtb->graph->RemoveRib(ribToRemoveID, o);

        vtb->graph->findOstiaNodesAndRibs();
        vtb->graph->wrapGraph();


        vtb->graph->printGraphOnGV("_afterVeinRemovalBeforeGapRemoval");
        vtb->graph->removeGaps_HFD1P2();
        vtb->graph->printGraph(o);
        vtb->graph->wrapGraph();

        o.close();

        vtb->graph->glueRibsToTerminalPaths();

        vtb->graph->clearRedoStack();

        cursor++;
        return cursor;
    }

    int DeleteVessel(int vesselIndex) {
        //auto info = GetVesselInfo(vesselIndex);
        //auto centerline = GetVesselCenterLine(vesselIndex);
        //auto biffurs= GetVesselBiffurcations(vesselIndex);
        int ribToRemoveID = -1;

        vtb->graph->printGraphOnGV("_beforeDeleteVessel");

        ofstream o;
        o.open("log_DeleteVessel.txt");
        o << "vesselIndex = " << vesselIndex << endl;
        o << "this->vtb->graph->numOfLeftTerminalPaths = " << this->vtb->graph->numOfLeftTerminalPaths << endl;
        o << "this->vtb->graph->numOfTerminalPaths = " << this->vtb->graph->numOfTerminalPaths << endl;

        // get voxel node that is the last bifurcation of

        auto nodeLast = *(this->vtb->graph->TerminalPaths[vesselIndex].end() - 1);
        auto lastNodeID = vtb->thinner->getVoxelNodeComponentID(nodeLast[0], nodeLast[1], nodeLast[2]);
        int beforeLastNodeID;
        vector<int> nodeBeforeLast;
        vector<int> iribs;

        if (lastNodeID > 0) {
            o << "lastNodeID = " << lastNodeID << endl;
            o << "PRINTING LAST NODE:\n ";
            vtb->graph->printNode(o, vtb->graph->Nodes[lastNodeID]);

            nodeBeforeLast = *(this->vtb->graph->NodesOnTerminalPaths[vesselIndex].end() - 2);
            beforeLastNodeID = vtb->thinner->getVoxelNodeComponentID(nodeBeforeLast[0], nodeBeforeLast[1], nodeBeforeLast[2]);

            ribToRemoveID = vtb->graph->Nodes[lastNodeID].incidentRibsID[0];

            /*
            o << "beforeLastNodeID = " << beforeLastNodeID << endl;
            o << "PRINTING PRE LAST NODE:\n ";
            vtb->graph->printNode(o, vtb->graph->Nodes[beforeLastNodeID]);

            iribs = vtb->graph->Nodes[lastNodeID].incidentRibsID;

            ribToRemoveID = -1;
            for (auto irib = iribs.begin(); irib != iribs.end(); irib++) {
                if (this->vtb->graph->Ribs[*irib].firstEndID == beforeLastNodeID
                    || this->vtb->graph->Ribs[*irib].secondEndID == beforeLastNodeID) {
                    ribToRemoveID = *irib;
                    break;
                }
            }*/
        } else {

            bool isFound = false;
            vector <int>* ribsPointer;
            //GraphRib * ribsPointer;
            if (vesselIndex < this->vtb->graph->numOfLeftTerminalPaths) {
                // left case
                ribsPointer = &(vtb->graph->LeftRibs);
            } else {
                // right case
                ribsPointer = &(vtb->graph->RightRibs);
            }
            for (auto irib = ribsPointer->begin(); irib != ribsPointer->end(); irib++) {
                auto points = vtb->graph->Ribs[*irib].points;
                for (auto icoord = points.begin(); icoord != points.end(); icoord++) {
                    if ((*icoord)[0] == nodeLast[0] && (*icoord)[1] == nodeLast[1] && (*icoord)[2] == nodeLast[2]) {
                        ribToRemoveID = *irib;
                        isFound = true;
                        break;
                    }
                }
                if (isFound) break;
            }
            lastNodeID = vtb->graph->Ribs[ribToRemoveID].firstEndID;
            beforeLastNodeID = vtb->graph->Ribs[ribToRemoveID].secondEndID;
        }
        o << "ribToRemoveID = " << ribToRemoveID << endl;
        o << "firstEndID = " << vtb->graph->Ribs[ribToRemoveID].firstEndID << endl;
        o << "secondEndID = " << vtb->graph->Ribs[ribToRemoveID].secondEndID << endl;

        o << "PRINTING RIB:\n ";
        vtb->graph->printRib(o, vtb->graph->Ribs[ribToRemoveID], 1);
        o << "PRINTING LAST NODE:\n ";
        vtb->graph->printNode(o, vtb->graph->Nodes[lastNodeID]);
        o << "PRINTING PRE LAST NODE:\n ";
        vtb->graph->printNode(o, vtb->graph->Nodes[beforeLastNodeID]);

        this->vtb->graph->RemoveRib(ribToRemoveID, o);

        o.close();

        vtb->graph->findOstiaNodesAndRibs();
        vtb->graph->wrapGraph();

        vtb->graph->glueRibsToTerminalPaths();

        vtb->graph->clearRedoStack();

        vtb->graph->printGraphOnGV("_afterDeleteVessel");
        cursor++;
        return cursor;
    }

private:
    FFRSettings _settings;
    mvox::Point3D_Double cubeCenter;
    int cursor;
public:
    mvox::Matrix4x4<float> spaceToImage;
    mvox::Matrix4x4<float> imageToSpace;
    VTB* vtb;
};



#if 1
void FFR_Process_PrepareVesselsProc(FFRProcessor* processor,
	mvox::Cube sourceCube,
	mvox::UpdateProgress progressFunction,
	VesselsSegmParameters vesselsSegmParameters) {

    t_FFR_Process_PrepareVesselsProc(processor,sourceCube,progressFunction,vesselsSegmParameters);

	//processor->vtb->findMeanAndDeviationInAorta();
	progressFunction(0.0f, L"Coronary arteries segmentation");
	
	//{
	//	//auto p1 = mvox::Point3D_Double(37.0635, 4.2392, -106.09) * sourceDataCube.SpaceToImage;
	//	//auto p2 = mvox::Point3D_Double(24.5534, 21.15185, -111.14) * sourceDataCube.SpaceToImage;
	//	//auto p3 = mvox::Point3D_Double(22.4925, 1.9893, -121.771) * sourceDataCube.SpaceToImage;

	//	auto p1 = mvox::Point3D_Double(12.4342, -1.2288, -114.671) * sourceCube.SpaceToImage;
	//	auto p2 = mvox::Point3D_Double(15.3208, 18.9988, -105.711) * sourceCube.SpaceToImage;
	//	auto p3 = mvox::Point3D_Double(29.2796, 1.57984, -99.0044) * sourceCube.SpaceToImage;

	//	double dp1[3] = { p1.x * sourceCube.scaleX, p1.y * sourceCube.scaleY, p1.z * sourceCube.scaleZ };
	//	double dp2[3] = { p2.x * sourceCube.scaleX, p2.y * sourceCube.scaleY, p2.z * sourceCube.scaleZ };
	//	double dp3[3] = { p3.x * sourceCube.scaleX, p3.y * sourceCube.scaleY, p3.z * sourceCube.scaleZ };
	//	processor->vtb->getComissuralArcs(dp1, dp2, dp3);
	//	exit(0);
	//}
#ifndef CEREBRAL_VESSELS
#ifndef SKIP_AORTA
	processor->initializeVesselness(sourceCube,
		vesselsSegmParameters.Alpha,
		vesselsSegmParameters.Beta,
		vesselsSegmParameters.Gamma);
#endif // !SKIP_AORTA
#endif // CEREBRAL_VESSELS
#ifdef MANUAL_SEGMENTATION
	///*
	// read manual segmented images;

	ifstream lb;
	ifstream rb;
	std::string left_filename = "";
	std::string right_filename = "";
	double lo[3] = { 0, 0, 0 };
	double ro[3] = { 0, 0, 0 };

	/*
	// pat 1
	left_filename = "leftBranch_pat1.txt", right_filename = "rightBranch_pat1.txt"
	lo[0]=235, lo[1]=291, lo[2]=146; ro[0] = 215, ro[1] = 235, ro[2]=123;
	*/
	/*
	// pat 3
	left_filename "leftBranch_pat3.txt", right_filename = "rightBranch_pat3.txt";
	lo[0]=282, lo[1=250, lo[2]=197;
	ro[0]=241, ro[1]=203, ro=169;
	*/
	/*
	// pat 4
	left_filename = "leftBranch_pat4.txt", right_filename = "rightBranch_pat4.txt";
	lo[0]=279, lo[1]=238, lo[2]=131;
	ro[0]=238, ro[1]=185, ro[2]=114;
	*/
	/*
	// pat 5
	left_filename = "leftBranch_pat4.txt", right_filename = "rightBranch_pat.txt";

	*/
	/*
	// pat 6
	left_filename = "leftBranch_pat6.txt", right_filename = "rightBranch_pat6.txt";
	lo[0]=265, lo[1]=243, lo[2]=135;
	ro[0]=232, ro[1]=194, ro[2]=122;
	*/
	/*
	// pat 7
	left_filename = "leftBranch_pat7.txt", right_filename = "rightBranch_pat7.txt";
	lo[0]=258, lo[1]=254, lo[2]=131;
	ro[0]=231, ro[1]=208, ro[2]=105;
	*/
	/*
	// pat 8
	left_filename = "leftBranch_pat8.txt", right_filename = "rightBranch_pat8.txt";
	lo[0]=236, lo[1]=256, lo[2]=196;
	ro[0]=217, ro[1]=192, ro[2]=176;
	*/
	/*
	// pat 9
	left_filename = "leftBranch_pat9.txt", right_filename = "rightBranch_pat9.txt";
	*/
	/*
	// pat 10
	left_filename = "leftBranch_pat10.txt", right_filename = "rightBranch_pat10.txt";
	lo[0]=225, lo[1]=297, lo[2]=145;
	ro[0] = 185, ro[1]=229, ro[2]=115;
	*/

	/*
	left_filename = "komissarova.txt";
	lo[0] = 226, lo[1]=186, lo[2]=15;
	*/

	/*
	left_filename = "PochukaevaLeftBranch.txt", right_filename = "PochukaevaRightBranch.txt";
	lo[0] = 220, lo[1]=281, lo[2]=dim[2]-124;
	ro[0]= 197, ro[1]=210, ro[2]=dim[2]-175;
	*/

	/*
	left_filename = "leftBranch_pat11.txt", right_filename = "rightBranch_pat11.txt";
	lo[0] = 240, lo[1]=289, lo[2]=139;
	ro[0]=217, ro[1]=243, ro[2]=113;
	*/
	/*
	left_filename = "leftBranch_pat12.txt", right_filename = "rightBranch_pat12.txt";
	lo[0] = 257, lo[1]=252, lo[2]=172;
	ro[0]=208, ro[1]=192, ro[2]=147;
	*/
	/* ============= HEART FLOW DATASETS ================*/
	/*
	left_filename = "leftBranch_Trofimova_HeartFlow.txt", right_filename = "rightBranch_Trofimova_HeartFlow.txt";
	lo[0] = 225, lo[1] = 373, lo[2]=205;
	ro[0]=219, ro[1]=276, ro[2]=188;
	*/

	/*
	left_filename = "leftBranch_bulanova_HEARTFLOW.txt", right_filename = "rightBranch_bulanova_HEARTFLOW.txt";
	lo[0]=233, lo[1]=329, lo[2]=215;
	ro[0]=194, ro[1]=270, ro[2]=194;
	*/

	/*
	left_filename = "leftBranch_satarova_HEARTFLOW.txt", right_filename = "rightBranch_satarova_HEARTFLOW.txt";
	lo[0]=202, lo[1]=296, lo[2]=171;
	ro[0]=168, r[1]=222, ro[2]=165;
	*/
	/*
	left_filename = "leftBranch_Kushchenko_HeartFlow.txt", right_filename = "rightBranch_Kushchenko_HeartFlow.txt";
	lo[0]=218, lo[1]=339, lo[2]=163;
	ro[0]=193, ro[1]=264, ro[2]=159;
	*/
	/*
	left_filename = "leftBranch_Martynov_HeartFlow.txt", right_filename = "rightBranch_Martynov_HeartFlow.txt";
	lo[0]=252, lo[1]=338, lo[2]=193;
	ro[0]=195, ro[1]=253, ro[2]=178;
	*/

	left_filename = "leftBranch_vasin2.txt", right_filename = "rightBranch_vasin2.txt";
	lo[0] = 263, lo[1] = 238, lo[2] = processor->vtb->dim[2] - 1 - 92;
	ro[0] = 227, ro[1] = 181, ro[2] = processor->vtb->dim[2] - 1 - 98;


	//left_filename = "log_komissarovaOstium.txt",			lo[0] = 226, lo[1]=184, lo[2]=15; 
	//left_filename = "cerebral_chirva.txt";				lo[0] = 253, lo[1] = 210, lo[2] = processor->vtb->aortaCenterOnFirstSlice[2]};
	//left_filename = "cerebral_kiselev.txt";				lo[0] = 279, lo[1] = 259, lo[2] = processor->vtb->aortaCenterOnFirstSlice[2]};
	//left_filename = "cerebral_vasilenko.txt",				lo[0] = 227, lo[1] = 213, lo[2] = processor->vtb->aortaCenterOnFirstSlice[2]};
	// left_filename = "cerebral_zhuravleva_before.txt";	lo[0] = 249, lo[1] = 229, lo[2] = 36;
	// left_filename = "cerebral_tsibulkin.txt";			lo[0] = 239, lo[1] = 232, lo[2] = 0;
	// left_filename = "cerebral_dashkaeva.txt";			lo[0] = 260, lo[1] = 194, lo[2] = 0;
	// left_filename = "cerebral_sedova.txt";				lo[0] = 231, lo[1] = 204, lo[2] = 12;
	// left_filename = "cerebral_benenson.txt";				lo[0] = 244, lo[1] = 254, lo[2] = 0;
	//left_filename = "cerebral_novikov.txt";					lo[0] = 260, lo[1] = 172, lo[2] = 19 ;

	lo_ptr = lo;
#ifndef CEREBRAL_VESSELS
	ro_ptr = ro;
#endif // !CEREBRAL_VESSELS


	processor->vtb->loadManualSegmentation(left_filename, right_filename, lo_ptr, ro_ptr);
#endif // MANUAL_SEGMENTATION

    t_FFR_Process_PrepareVesselsProc_fin(sourceCube, processor->vtb->aortaMask, processor->vtb->nearAortaMask);

}


void FFR_Process_LoadVesselsPreview(FFRProcessor* processor,
	mvox::Cube segmCube,
	unsigned char targetCode,
	double threshold) {

    t_FFR_Process_LoadVesselsPreview(processor,segmCube,targetCode, threshold, processor->vtb);

	if (segmCube.Format != mvox::PixelFormat::Y)
        throw std::runtime_error("Cube must be Y format");

	// setImage orientation
	auto p0 = mvox::Point3D_Double(0, 0, 0) * segmCube.ImageToSpace;
	auto p_x_max = mvox::Point3D_Double(1, 0, 0) * segmCube.ImageToSpace;
	auto p_y_max = mvox::Point3D_Double(0, 1, 0) * segmCube.ImageToSpace;

	if (p_x_max.x < p0.x)
		processor->vtb->reversedX = 1;
	if (p_y_max.y < p0.y)
		processor->vtb->reversedY = 1;

	double old_frangi_thld = processor->vtb->parameters->frangiThreshold;

	if (threshold > 1e-8)
		processor->vtb->parameters->frangiThreshold = threshold;
	else
		processor->vtb->parameters->frangiThreshold = 70;

	// comment when manual segmentation is used
#ifndef MANUAL_SEGMENTATION
	if (old_frangi_thld != threshold) {
		processor->vtb->preprocessCoronaryArteries();
		processor->vtb->regrowUserSeeds(); // regrow regions from user seeds in case of frangi threshold change
	}
#endif
	// TODO VesselObjectIndex = ?
	processor->MarkVessels(segmCube, targetCode, 0);
	processor->MarkVessels(segmCube, targetCode, 1);
	processor->MarkVessels(segmCube, targetCode, 2);

    t_FFR_Process_LoadVesselsPreview_fin(processor,segmCube,targetCode, processor->vtb);
}


FFRProcessor* FFR_Initialize(FFRSettings settings) {
    t_FFR_Initialize(settings);
    return new FFRProcessor(settings);
}

int FFR_Process(FFRProcessor* processor,
	mvox::Cube sourceCube,
	mvox::UpdateProgress progressFunction,
	CompleteParameters completeParameters) {

    t_FFR_Process(processor,sourceCube,progressFunction,completeParameters,processor->vtb);

    if (sourceCube.Format != mvox::PixelFormat::sY2)
        throw std::runtime_error("Format must be sY2");
	auto vtb = processor->vtb;

#ifdef PRINT_BRANCHES
	progressFunction(0.05f, L"Vessel construction");

	/*ofstream o;
	o.open("segmented_branches.vtk");
	o << "# vtk DataFile Version 4.0\nBranches \nASCII\nDATASET STRUCTURED_POINTS\n";
	o << "DIMENSIONS "<<vtb->dim[0]<<" "<<vtb->dim[1] <<" "<<vtb->dim[2]<<endl;
	o << "SPACING " <<vtb->vsize[0]<<" "<<vtb->vsize[1] <<" "<<vtb->vsize[2]<<endl;
	o << "ORIGIN " <<vtb->dim[0]/2<<" "<<vtb->dim[1]/2 <<" "<<vtb->dim[2]/2<<endl;
	o << "POINT_DATA " << vtb->n <<endl;
	o << "SCALARS VTK_UNSIGNED_CHAR char 1\n";
	o << "LOOKUP_TABLE default\n";
	for (size_t i=0; i<vtb->n; ++i)
	o << (vtb->leftBranchMask[i] ||vtb->rightBranchMask[i]) <<endl;
	o.close();
	*/

	// Print header
	ofstream mhd;
	mhd.open("segmented_branches.mhd");
	mhd << "ObhectType = Image\nNDims = 3\nDimSize = " << vtb->dim[0] << " " << vtb->dim[1] << " " << vtb->dim[2] << endl;
	//mhd << "ElementType = MET_USHORT\nElementSpacing = " << vtb->vsize[0] << " " << vtb->vsize[1] << " " << vtb->vsize[2] <<endl;
	/*
	mhd << "TransformMatrix = " <<
		vtb->transformMatrix[0] << " " << vtb->transformMatrix[1] << " " << vtb->transformMatrix[2] << " "
		<< vtb->transformMatrix[3] << " " << vtb->transformMatrix[4] << " " << vtb->transformMatrix[5] << " "
		<< vtb->transformMatrix[6] << " " << vtb->transformMatrix[7] << " " << vtb->transformMatrix[8] << "\n";
	mhd << "Offset = " << vtb->origin[0] << " " << vtb->origin[1] << " " << vtb->origin[2] << "\n";
	*/
	//  AnatomicalOrientation = RAI
	//mhd << "DimSize = " << vtb->dim[0] << " " << vtb->dim[1] << " " << vtb->dim[2] << "\n";
	mhd << "ElementType = MET_UCHAR\n";
	mhd << "ElementSpacing = " << vtb->vsize[0] << " " << vtb->vsize[1] << " " << vtb->vsize[2] << "\n";
	mhd << "ElementDataFile = segmented_branches.raw\n";
	mhd.close();

	//Print raw data
	ofstream raw;
	raw.open("segmented_branches.raw");
	for (size_t i = 0; i < vtb->n; ++i)
		raw << (vtb->vesselComponents[i] > 0);
	raw.close();
	//exit(0);
#endif

#ifndef MANUAL_SEGMENTATION
#ifndef CEREBRAL_VESSELS
	// correct ostium
	progressFunction(0.1f, L"Vessel construction");
    if (vtb->leftOstia > 0)
		vtb->leftOstia = vtb->correctOstiaPoint("left");

	progressFunction(0.15f, L"Vessel construction");
    if (vtb->rightOstia > 0)
        vtb->rightOstia = vtb->correctOstiaPoint("right");

    t_FFR_Process_trace(processor->vtb);

#endif // CEREBRAL_VESSELS
#endif // MANUAL_SEGMENTATION

	/*
	// Print raw
	ofstream vout;
	vout.open("vesselMask.raw");
	for (auto i = 0; i < vtb->n; ++i)
		vout << (vtb->vesselComponents[i] ? 1 : 0);
	vout.close();

	// Print header
	ofstream mhd;
	mhd.open("vesselMask.mhd");
	mhd << "ObhectType = Image\nNDims = 3\nDimSize = " << vtb->dim[0] << " " << vtb->dim[1] << " " << vtb->dim[2] << endl;
	mhd << "ElementType = MET_USHORT\nElementSpacing = " << vtb->vsize[0] << " " << vtb->vsize[1] << " " << vtb->vsize[2] << "\nElementDataFile = segmented_branches.raw";
	mhd.close();

	*/

	progressFunction(0.2f, L"Vessel construction");
	/* Load manual segmentation for patien ishmanov
		Note that some parts of coronary arteries are segmented manually,
		ostium detected and preserved after overwriting by manual segmentation*/
		/*
		for (auto i = 0; i < vtb->n; i++)
			vtb->vesselComponents[i] = 0;
		ifstream in;
		in.open("leftBranch_ishmanov.txt");
		for (auto i = 0; i < 16183; i++) {
			unsigned long long ind;
			in >> ind;
			vtb->vesselComponents[ind] = 1;
		}
		in.close();

		in.open("rightBranch_ishmanov.txt");
		for (auto i = 0; i < 15053; i++) {
			unsigned long long ind;
			in >> ind;
			vtb->vesselComponents[ind] = 2;
		}
		in.close();
		*/

		/* Load manual segmentation for patien trofimova
		Note that some parts of coronary arteries are segmented manually,
		ostium detected and preserved after overwriting by manual segmentation*/
		/*
		for (auto i = 0; i < vtb->n; i++)
			vtb->vesselComponents[i] = 0;
		ifstream in;
		in.open("leftBranch_trofimova.txt");
		for (auto i = 0; i < 18903; i++) {
			unsigned long long ind;
			in >> ind;
			vtb->vesselComponents[ind] = 1;
		}
		in.close();

		in.open("rightBranch_trofimova.txt");
		for (auto i = 0; i < 11464; i++) {
			unsigned long long ind;
			in >> ind;
			vtb->vesselComponents[ind] = 2;
		}
		in.close();
		vtb->rightOstia = vtb->getIndex(218, 275, 188);
		vtb->leftOstia = vtb->getIndex(225, 378, 206);
		*/
	if (vtb->rightOstia > 0 || vtb->leftOstia > 0) {

		vtb->InitializeThinner();
		progressFunction(0.6f, L"Vessel construction");

		ofstream o;
		o.open("log_inte_ostia.txt");

		vtb->thinner->leftOstiaID = vtb->leftOstia;
		vtb->thinner->rightOstiaID = vtb->rightOstia;

        o << "left : thinner =" << vtb->thinner->leftOstiaID<< ", vtb = " << vtb->leftOstia<< "\n";
        o << "right : thinner =" << vtb->thinner->rightOstiaID << ", vtb = " << vtb->rightOstia << "\n";
		o.close();

		vtb->thinner->maxNoiseLength = processor->vtb->parameters->maxNoiseLength;
		vtb->thinner->mainAlgorithm();
		progressFunction(0.9f, L"Vessel construction");

		assert(vtb->graph->checkVoxelNodesUpToDate());

		vtb->InitializeGraph();
		//vtb->graph = new Graph(vtb->thinner);
#ifndef CEREBRAL_VESSELS
		vtb->graph->glueRibsToTerminalPaths();
#else // CEREBRAL_VESSELS
		vtb->graph->glueRibsToTerminalPaths();
		//vtb->graph->returnRibsAsTerminalPaths();
#endif //CEREBRAL_VESSELS
		ofstream out;
		out.open("log_graphGraph.txt");
		vtb->graph->printGraph(out);
		out.close();
		//для третьего набора данных из Китая
		//vtb->leftThinner->removeGap2();

		// remove gap for Nevraev
		// vtb->rightThinner->removeGap();
		vtb->graph->printGraphOnGV("_initial");
	}

	progressFunction(0.99f, L"Vessel construction");

    t_FFR_Process_fin(processor->GetCursor());

    // TODO разкомментить это для удаления вен
	return processor->GetCursor();

}


// Это вариант AortaSearch_FindAorta, которая ищет кружок на указанном срезе
// при заданных параметрах поиска - числа окружностей и радиусов кружков. 
// Возвращает число и найденные кружки в виде массива 4-к 
// double {center.x, center.y, center.z, radius}
// Вызывающая функция должна обеспечить массив достаточной длины
//
int AortaSearch_FindAorta(mvox::Cube sourceCube, double *circles) { 
    //  int sliceIndex, 
    int numCircles = 2; double minRadius = 10, maxRadius = 35;
    
    tracer.log("AortaSearch_FindAorta()");
    t_AortaSearch_FindAorta(sourceCube);   

    typedef itk::ImportImageFilter< short, 2 > ImportFilterType;
    ImportFilterType::Pointer importFilter = ImportFilterType::New();
    ImportFilterType::SizeType size;
    size[0] = sourceCube.width; size[1] = sourceCube.height;

    ImportFilterType::IndexType start;
    start.Fill(0);
    ImportFilterType::RegionType region;
    region.SetIndex(start);
    region.SetSize(size);
    importFilter->SetRegion(region);

    const itk::SpacePrecisionType origin[2] = { 0.0, 0.0 };
    importFilter->SetOrigin(origin);
    const itk::SpacePrecisionType  spacing[2] = { 1.0, 1.0 };
    importFilter->SetSpacing(spacing);

//------------------------------------------
    //find anatomically upmost slice p0 or p1
    auto p0 = mvox::Point3D_Double(0, 0, 0) * sourceCube.ImageToSpace;
    auto p1 = mvox::Point3D_Double(0, 0, sourceCube.depth - 1) * sourceCube.ImageToSpace;

    unsigned long long sliceIndex = 0;
#ifndef CEREBRAL_VESSELS
    if (p0.z < p1.z)
        sliceIndex = sourceCube.depth - 1;
#else // CEREBRAL_VESSELS
    if (p0.z > p1.z)
        sliceIndex = sourceCube.depth - 1;
#endif // CEREBRAL_VESSELS

    /*
    ofstream o;
    o.open("log_aortaFirstID.txt");

    o << "p0.z = " << p0.z << ", p1.z" << p1.z << endl << sliceIndex;
    o.close();
    */
    // check if circles are occure 
    double darkVoxelCount = 0;
    short* slice = (short*)sourceCube.Data;
    slice += sliceIndex * size[0] * size[1];
    tracer.logInt("sliceIndex",sliceIndex);

    short val = slice[0];
    for (int j = 0; j < size[0] * size[1]; j++) {
        if (val == slice[j])
            darkVoxelCount++;
    }

    if (darkVoxelCount / size[0] / size[1] > 0.5) {
        // if circles narrows find slice where circle radii start stabilizing

#ifndef CEREBRAL_VESSELS
        if (p0.z > p1.z)
#else // CEREBRAL_VESSELS
        if (p0.z > p1.z)
#endif // CEREBRAL_VESSELS
        {
            short* slice;
            int prev_count = 0;
            int count = 0;
            double val;
            for (sliceIndex = 0; sliceIndex < sourceCube.depth; sliceIndex++) {
                slice = (short*)sourceCube.Data;
                slice += sliceIndex * size[0] * size[1];
                count = 0;
                val = slice[0];
                for (int j = 0; j < size[0] * size[1]; j++) {
                    if (val == slice[j])
                        count++;
                }
                if (sliceIndex != 0) {
                    if (prev_count != count) { prev_count = count; continue; }
                    sliceIndex--;
                    break;
                }
                prev_count = count;
            }
        } else {
            short* slice;
            int prev_count = 0;
            int count = 0;
            double val;
            for (sliceIndex = sourceCube.depth - 1; sliceIndex > 1; sliceIndex--) {
                slice = (short*)sourceCube.Data;
                slice += sliceIndex * size[0] * size[1];
                count = 0;
                val = slice[0];
                for (int j = 0; j < size[0] * size[1]; j++) {
                    if (val == slice[j])
                        count++;
                }
                if (sliceIndex != 0) {
                    if (prev_count != count) { prev_count = count; continue; }
                    sliceIndex++;
                    break;
                }
                prev_count = count;
            }
        }
    }

//-----------------------------------------

    slice = (short*)sourceCube.Data;
    slice += sliceIndex * size[0] * size[1];

    int  tmp_size[2] = { sourceCube.width, sourceCube.height };
    double tmp_spacing[2] = { 1,1 };
    Utils::printSliceOnPng("aorta_slice_new.png", slice, tmp_size, tmp_spacing);

    using ImageType = itk::Image<short, 2>;
    importFilter->SetImportPointer(slice, size[0] * size[1], false);

    typedef itk::HoughTransform2DCirclesImageFilter<short,
        float, float> HoughTransformFilterType;
    HoughTransformFilterType::Pointer houghFilter
        = HoughTransformFilterType::New();
    houghFilter->SetInput(importFilter->GetOutput());
    houghFilter->SetNumberOfCircles(numCircles);
    houghFilter->SetMinimumRadius(minRadius / sourceCube.scaleX);
    houghFilter->SetMaximumRadius(maxRadius / sourceCube.scaleX);
    houghFilter->Update();

    HoughTransformFilterType::CirclesListType _circles;
    _circles = houghFilter->GetCircles();

    int i = -1;
    for (auto itCircles = _circles.begin(); itCircles != _circles.end(); itCircles++) {
        i++; //tracer.logInt("AortaSearch_FindAortaOnSlice i=",i);        
        const HoughTransformFilterType::CircleType::PointType centerPoint = (*itCircles)->GetCenterInObjectSpace();
        int X  = itk::Math::Round<ImageType::IndexType::IndexValueType>(centerPoint[0]);
        int Y  = itk::Math::Round<ImageType::IndexType::IndexValueType>(centerPoint[1]);
        mvox::Point3D_Double point = mvox::Point3D_Double(X, Y, sliceIndex) * sourceCube.ImageToSpace;
        double radius = (*itCircles)->GetRadiusInObjectSpace()[0] * sourceCube.scaleX;
        circles[4*i] = point.x; circles[4*i+1] = point.y; circles[4*i+2] = point.z;
        circles[4*i+3] = radius;
    }

    t_AortaSearch_FindAorta_fin(sourceCube,circles, i+1);

    return i+1;
}

//-------------------------------------------------------------------
void FFR_LoadAortaObject(FFRProcessor* processor,
	mvox::Cube segmCube,
    uint8_t targetCode) {

    t_FFR_LoadAortaObject(processor,segmCube,targetCode);

#ifndef CEREBRAL_VESSELS
#ifndef SKIP_AORTA
	processor->MarkAorta(segmCube, targetCode);

    t_FFR_LoadAortaObject_fin(segmCube,targetCode);

#endif //SKIP_AORTA
#endif //CEREBRAL_VESSELS
}


void FFR_Process_PrepareAortaProc(FFRProcessor* processor,
	mvox::Cube sourceCube,
	mvox::UpdateProgress progressFunction) {

    t_FFR_Process_PrepareAortaProc(processor,sourceCube,progressFunction);

    progressFunction(0.0f, L"Aorta segmentation");
	//#ifndef CEREBRAL_VESSELS
	processor->segmAorta(sourceCube);

    t_FFR_Process_PrepareAortaProc_fin(sourceCube);

	//#endif // CEREBRAL_VESSELS
}

double FFR_GetOptimalTau(FFRProcessor* processor) {
    t_FFR_GetOptimalTau(processor);
    if (processor->vtb && processor->vtb->idt) // check if VTB and IDT are already constructed
        return processor->vtb->idt->optimal_tau;
    return -1.0; // otherwise return negative value to indicate that optimal tau is unknown
}
void FFR_Process_LoadAortaPreview(FFRProcessor* processor,
	mvox::Cube segmCube,
    uint8_t targetCode,
	double tau) {

    t_FFR_Process_LoadAortaPreview(processor,segmCube,targetCode,tau);

	if (processor->vtb->userSeedPointsCount > 0) {
		processor->vtb->userSeedPoints.clear();
		processor->vtb->userSeedPointsCount = 0;
		for (auto i = 0; i < processor->vtb->n; i++)
			processor->vtb->Vesselness[i] = 0;
	}
	if (segmCube.Format != mvox::PixelFormat::Y)
        throw std::runtime_error("Cube must be Y format");
	//if (!processor->vtb->aortaMask) //|| !processor->vtb->idt)
	//return;
#ifndef CEREBRAL_VESSELS
#ifndef	SKIP_AORTA

	processor->vtb->updateAortaCut(tau);
	processor->MarkAorta(segmCube, targetCode);

    t_FFR_Process_LoadAortaPreview_fin(segmCube, targetCode);

#endif // SKIP_AORTA
#endif // CEREBRAL_VESSELS
}


void FFR_LoadVesselsObject(FFRProcessor* processor,
	mvox::Cube segmCube,
    uint8_t targetCode,
	int vesselObjectIndex) {

    t_FFR_LoadVesselsObject(processor, segmCube, targetCode, vesselObjectIndex);

    processor->MarkVessels(segmCube, targetCode, vesselObjectIndex);

    t_FFR_LoadVesselsObject_fin(segmCube, targetCode, vesselObjectIndex);
}

int FFR_GetVesselsCount(FFRProcessor* processor) {
    t_FFR_GetVesselsCount(processor);
    return processor->GetVesselsCount();
}

void FFR_GetVesselInfo(FFRProcessor* processor,
	int vesselIndex,
	int* centerLineCount,
	int* bifurcationsCount,
	wchar_t* name)
	//extern "C" __declspec(dllexport) void FFR_GetVesselInfo(FFRProcessor *processor, 
	//														int vesselIndex, 
	//														int *centerLineCount,
	///														wchar_t *name)
{
    t_FFR_GetVesselInfo(processor,vesselIndex,centerLineCount,bifurcationsCount,name);

    auto info = processor->GetVesselInfo(vesselIndex);
	*centerLineCount = info.CenterLineCount;
	*bifurcationsCount = info.BifurcationCount;
	wcscpy(name, info.VesselName.c_str());

    t_FFR_GetVesselInfo_fin(processor,vesselIndex,centerLineCount,bifurcationsCount,name);
}

void FFR_GetVesselBifurcations(FFRProcessor* processor,
	int vesselIndex,
	mvox::Point3D_Double* dest,
	int bufferCount) {

    t_FFR_GetVesselBifurcations(processor,vesselIndex,dest,bufferCount);

    // TODO check!
	auto bifurcation = processor->GetVesselBiffurcations(vesselIndex);
	if (bifurcation.size() != bufferCount)
		throw std::runtime_error("Bifurcations size error");
    std::copy(bifurcation.begin(), bifurcation.end(), dest);

    t_FFR_GetVesselBifurcations_fin(processor,vesselIndex,dest,bufferCount);
}

//TODO сначала вызывается это, затем FFR_Process_LoadVesselsPreview
//поэтому нужно здесь задавать только точки, а в loadVesselsPreview подгружать region growing
void FFR_Process_SetVesselsSeeds(FFRProcessor* processor,
	mvox::Point3D_Double* seedPoints,
	int count) {

    t_FFR_Process_SetVesselsSeeds(processor,seedPoints,count);

    auto vtb = processor->vtb;

	vector <vector<int> > seedPointsInt;
	vector<int> seedPoint(3);

	for (int i = 0; i < count; i++) {
		auto point = seedPoints[i] * processor->spaceToImage;
		seedPoint[0] = point.x;
		seedPoint[1] = point.y;
		seedPoint[2] = point.z;
		seedPointsInt.push_back(seedPoint);
	}
	processor->vtb->userSeedPoints = seedPointsInt;
	//processor->vtb->regrowUserSeeds();

	if (vtb->userSeedPointsCount < count) {
		vtb->userSeedPointsCount = count;
		// TODO добавлять только сосуды, не совпадающие с правой и левой ветвью
		vtb->addUserVessel(vtb->getIndex(seedPointsInt[count - 1][0],
										 seedPointsInt[count - 1][1],
										 seedPointsInt[count - 1][2]));
	} else if (vtb->userSeedPointsCount > count) {
		vtb->userSeedPointsCount = count;
		vtb->popUserVessel();
	}
}


void FFR_GetVesselCenterLine(FFRProcessor* processor,
	int vesselIndex,
	mvox::Point3D_Double* dest,
	int bufferCount) {

    t_FFR_GetVesselCenterLine(processor,vesselIndex,dest,bufferCount);

    auto centerLine = processor->GetVesselCenterLine(vesselIndex);
	if (centerLine.size() != bufferCount)
        throw std::runtime_error("centerline length error");

    std::copy(centerLine.begin(), centerLine.end(), dest);

    t_FFR_GetVesselCenterLine_fin(processor,vesselIndex,dest,bufferCount);
}


void FFR_Close(FFRProcessor* processor) {
    tracer.log("FFR_Close()");
    delete processor;
}


int FFR_GetVesselsObjectsCount(FFRProcessor* processor) {

    t_FFR_GetVesselsObjectsCount(processor);

	//если в виде двух объектов левая и правая - то возвращаем 2, сейчас в примере 2
    return 2 + (processor->vtb->userMarkedVessels.size() > 0 ? 1 : 0);
}


int FFR_DeleteVein(FFRProcessor* processor, int vesselIndex, mvox::Point3D_Double veinPosition) {
	//processor->vtb->graph->printGraphOnGV("_beforeDeleteVein");
    tracer.log("FFR_DeleteVein()");
    return processor->DeleteVein(veinPosition);

}

int FFR_DeleteVessel(FFRProcessor* processor, int vesselIndex) {
    tracer.logInt("FFR_DeleteVessel()",vesselIndex);
    return processor->DeleteVessel(vesselIndex);
}

void FFR_MoveCursor(FFRProcessor* processor, int cursor) {
    tracer.log("FFR_MoveCursor()");
    if (cursor < processor->GetCursor()) {
		// undo
		if (!processor->vtb->graph->LastRemovedRibIsTerminal()) {
			//			ofstream o1, o2;
			//			o1.open("log_graphBeforeUndoRemoveGaps.txt");

			processor->vtb->graph->printGraphOnGV("_BeforeUndoRemoveGaps.gv");
			//			processor->vtb->graph->printGraph(o1);
			//			o1.close();

			processor->vtb->graph->UndoRemoveGaps();

			processor->vtb->graph->printGraphOnGV("_AfterUndoRemoveGaps.gv");
			//			o2.open("log_graphAfterUndoRemoveGaps.txt");
			//			processor->vtb->graph->printGraph(o2);
			//			o2.close();
		}
		processor->vtb->graph->UndoRemoveRib();
	} else {
		// redo
		bool ribToRemoveIsTerminal = processor->vtb->graph->LastRedoRibIsTerminal();
		processor->vtb->graph->RedoRemoveRib();
		if (!ribToRemoveIsTerminal) // if redo for remove vein
			processor->vtb->graph->removeGaps_HFD1P2();
	}
	processor->vtb->graph->findOstiaNodesAndRibs();
	processor->vtb->graph->wrapGraph();

	processor->vtb->graph->printGraphOnGV("_MoveCursor");

	ofstream o, ogv;
	o.open("graph_moveCursor.txt");
	processor->vtb->graph->printGraph(o);
	o.close();


	processor->vtb->graph->glueRibsToTerminalPaths();


	// TODO why comment?
	//assert(vtb->graph->checkVoxelNodesUpToDate());
	processor->SetCursor(cursor);
}




void FFR_PrepareResult(FFRProcessor* processor,
	FFRStenosis* stenosis,
	int stenosisCount,
	FFRTextWriter writer) {

    t_FFR_PrepareResult(processor,stenosis,stenosisCount);

	ofstream log;
	log.open("log_FFR_PrepareResult.txt");

	std::cout.precision(4);
	unsigned i;
	Graph* graph = processor->vtb->graph;
	Thinner* thinner = processor->vtb->thinner;

	int front[3], end[3];
	FFRStenosis stns;

	log << "Reloading graph\nNum of Nodes before = " << graph->Nodes.size() << ", Num of edges = " << graph->Ribs.size() << endl;
	if (processor->vtb->leftOstia > -1 || processor->vtb->rightOstia > -1)
		graph->reloadGraph();
	log << "done\nNum of Nodes after = " << graph->Nodes.size() << ", Num of edges = " << graph->Ribs.size() << endl;
	log << "stenosis count = " << stenosisCount << endl;
	log << "Loading stenoses\n";
	for (i = 0; i < stenosisCount; ++i) {
		log << "\n " << i;
		// передать real координаты стенозов в целочисленные инкрементированные thinner->Segments
		stns = stenosis[i];
		auto point = stns.Front.Position * processor->spaceToImage;
		front[0] = point.x + 1;
		front[1] = point.y + 1;
		front[2] = point.z + 1;
		point = stns.Rear.Position * processor->spaceToImage;
		end[0] = point.x + 1;
		end[1] = point.y + 1;
		end[2] = point.z + 1;

		log << "\nlocating stenosis" << endl;
		log << "done\nNum of Nodes before = " << graph->Nodes.size() << ", Num of edges = " << graph->Ribs.size() << endl;

		graph->locateWholeStenosis(i, front, end, stenosis[i].StenosisType, stenosis[i].UserStenosisPercent * 0.01);
		log << "done\nNum of Nodes after = " << graph->Nodes.size() << ", Num of edges = " << graph->Ribs.size() << endl;

	}

	log << "\nWrappingGraph" << endl;
	// оборачиваем граф с переупорядочиванием 
	graph->wrapGraph();
	log << "Done" << endl;

	ofstream o;
	o.open("log_graphFinal.txt");
	graph->printGraph(o);
	o.close();


	graph->printGraphOnGV("check");


	ofstream graphGV;
	graphGV.open("graph.gv");
	graphGV << "graph coronaryTree {\ngraph[dpi=300];\n";






	/*
	//print graphGV
	// узлы левой ветви
	if (graph->LeftNodes.size() > 0)
	{
		// число узлов
		for (i = 0; i<graph->LeftNodes.size(); ++i) {
			auto node = graph->Nodes[graph->LeftNodes[i]];
			// knot number \n
			if (i == 0)
				graphGV << "L_" << i + 1 << "_" << node.ID << " [color=red, shape=box];\n";
			else
				graphGV << "L_" << i + 1 << "_" << node.ID << " [color=red];\n";
		}
	}

	log << "\nprinting right nodes";
	// узлы правой ветви
	if (graph->RightNodes.size()> 0) {
		for (i = 0; i<graph->RightNodes.size(); ++i) {
			auto node = graph->Nodes[graph->RightNodes[i]];
			// knot number \n
			if (i == 0)
				graphGV << "R_" << i + 1 << "_" << node.ID << " [color=blue, shape=box];\n";
			else
				graphGV << "R_" << i + 1 << "_" << node.ID << " [color=blue];\n";

		}
	}
	// сегменты левой ветви

	if (graph->LeftRibs.size() > 0) {
		for (i = 0; i<graph->LeftRibs.size(); ++i)
		{
			auto rib = graph->Ribs[graph->LeftRibs[i]];
			// start_node_index end_node_index \n
			int beginID = graph->Nodes[rib.firstEndID].labelID + 1;
			int endID = graph->Nodes[rib.secondEndID].labelID + 1;
			if (beginID > endID) {
				graphGV << "L_" << endID << "_" << graph->Nodes[rib.secondEndID].ID
					<< " -- L_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " [color=";
				if (rib.isGapRib)
					graphGV << "grey";
				else
					graphGV << "red";
				graphGV << ", label=\"" << i + 1 << "_" << rib.ID;
			}
			else {
				graphGV << "L_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " -- L_" << endID << "_" << graph->Nodes[rib.secondEndID].ID << " [color=";
				if (rib.isGapRib) {
					if (rib.marker == STENT)
						graphGV << "\"grey:invis:grey\"";
					else
						graphGV << "grey";
				}
				else {
					if (rib.marker == STENT)
						graphGV << "\"red:invis:red\"";
					else
						graphGV << "red";
				}
				graphGV << ", label=\"" << i + 1 << "_" << rib.ID;
			}

			// segment length \n
			double segmentLength = 0.1*thinner->getSegmentLength(rib.points, 4);
			graphGV << "\\nlen = " << segmentLength << "cm";
			int parentID = graph->Ribs[graph->LeftRibs[i]].parentRib;
			int childID = graph->Ribs[graph->LeftRibs[i]].childRib;
			graphGV << "\\nparent = " << parentID;
			graphGV << "\\nchild = " << childID;
			// segment average raduis \n
			double averageDiameter = 0;

			log << "rib " << i <<"_" << rib.ID << endl;
			log << "child = " << childID << endl;
			if (childID >= 0)
				log << "child points count = " << graph->Ribs[childID].points.size() << endl;
			log << "parent = " << parentID << endl;
			if (parentID >= 0)
				log << "parent points count = " << graph->Ribs[parentID].points.size() << endl;

			if (rib.isGapRib) {
				log << "Gap rib" << endl;
				if (childID >= 0) {// has child
								   //averageDiameter = graph->Ribs[childID].diameterCM;
					log << "has child" << endl;
					averageDiameter = graph->meanDiameterOnChildSegment(rib.ID, 15);
					log << "averageDiameter on child segment" << graph->meanDiameterOnChildSegment(rib.ID, 15) << endl;
					if (parentID >= 0) {
						log << "has parent" << endl;
						if (2 == graph->Nodes[graph->findGraphNodeBetweenRibs(rib.ID, parentID)].degree) {
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, parentID);
							averageDiameter /= 2.0;
							log << "averageDiameter on child segment" << graph->meanDiameterOnParentSegment(rib.ID, parentID) << endl;
						}
					}
				}
				else if (parentID >= 0) {// has no child but parent
										//averageDiameter = graph->Ribs[parentID].diameterCM;
					log << "no child, has parent" << endl;
					averageDiameter = graph->meanDiameterOnParentSegment(rib.ID, 15);

				} else { // has no parent or child
					averageDiameter = rib.diameterCM;
				}
			}
			else {
				log << "Not gap rib" << endl;
				if (rib.marker == FLOW3D) {
					log << "marker Flow 3d " << endl;
					averageDiameter = 0;
					double numOfNeighbours = 0; // 0(no parent or child ), 1(parent or child) or 2 (parent+child)
					if (childID > 0) {
						log << "has child " << endl;
						if (graph->Ribs[childID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnChildSegment(rib.ID, 15);
							log << "graph->meanDiameterOnChildSegment(rib.ID, 15) =  "<< graph->meanDiameterOnChildSegment(rib.ID, 15) << endl;
							//averageDiameter += graph->Ribs[childID].diameterCM;
						}
					}
					if (parentID > 0) {
						log << "has parent " << endl;
						if (graph->Ribs[parentID].marker == REGULAR) {
							log << "regular marker" << endl;
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, 15);
							log << "graph->meanDiameterOnParentSegment(rib.ID, 15) = " << graph->meanDiameterOnParentSegment(rib.ID, 15) << endl;
							//averageDiameter += graph->Ribs[parentID].diameterCM;
						}
					}
					if (numOfNeighbours > 0) {
						log << "get rib average diam" << endl;
						averageDiameter *= (1.0 - rib.stenosisPersent) / numOfNeighbours;
					}
					else {
						log << "get rib diameterCM" << endl;
						averageDiameter = rib.diameterCM;
					}
				}
				else {
					log << "No flow 3d marker" << endl;
					averageDiameter = rib.diameterCM;
					if (rib.marker == STENOSIS) {
						log << "get rib diameterCM with persent" << endl;
						averageDiameter *= (1.0 - rib.stenosisPersent);
					}
				}
			}

			graphGV << "\\ndiam = " << averageDiameter << "cm\"";
			if (rib.marker == REGULAR) // regular vessel
				graphGV << "];\n";
			else if (rib.marker == STENOSIS) // stenosis
				graphGV << "penwidth=7];\n";
			else if (rib.marker == STENT) // stent
				graphGV << "style=bold];\n";
			else if (rib.marker == FLOW3D) // flow 3D
				graphGV << "style=dashed];\n";
		}
	}

	// сегменты правой ветви
	if (graph->RightRibs.size() > 0) {
		for (i = 0; i<graph->RightRibs.size(); ++i) {

			auto rib = graph->Ribs[graph->RightRibs[i]];

			// start_node_index end_node_index \n
			int beginID = graph->Nodes[rib.firstEndID].labelID + 1;
			int endID = graph->Nodes[rib.secondEndID].labelID + 1;
			if (beginID > endID) {
				graphGV << "R_" << endID << "_" << graph->Nodes[rib.secondEndID].ID
					<< " -- R_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " [color=";
				if (rib.isGapRib)
					graphGV << "grey";
				else
					graphGV << "blue";
				graphGV << ", label=\"" << i + 1 << "_" << rib.ID;
			}
			else {
				graphGV << "R_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " -- R_" << endID << "_" << graph->Nodes[rib.secondEndID].ID
					<< " [color=";

				if (rib.isGapRib) {
					if (rib.marker == STENT)
						graphGV << "\"grey:invis:grey\"";
					else
						graphGV << "grey";
				}
				else {
					if (rib.marker == STENT)
						graphGV << "\"blue:invis:blue\"";
					else
						graphGV << "blue";

				} graphGV << ", label=\"" << i + 1 << "_" << rib.ID;

			}

			// segment length \n
			double segmentLength = 0.1*thinner->getSegmentLength(rib.points, 4);
			graphGV << "\\nlen = " << segmentLength << "cm";
			int parentID = graph->Ribs[graph->RightRibs[i]].parentRib;
			int childID = graph->Ribs[graph->RightRibs[i]].childRib;
			graphGV << "\\nparent = " << parentID;
			graphGV << "\\nchild = " << childID;

			// segment average raduis \n
			double averageDiameter = 0;

			if (rib.isGapRib) {
				if (childID >= 0) { // has child
									//averageDiameter = graph->Ribs[childID].diameterCM;
					averageDiameter = graph->meanDiameterOnChildSegment(rib.ID, 15);
					if (parentID >= 0) {
						if (2 == graph->Nodes[graph->findGraphNodeBetweenRibs(rib.ID, parentID)].degree) {
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, parentID);
							averageDiameter /= 2.0;
						}
					}
				}
				else if (parentID >= 0) // has no child but parent
										//averageDiameter = graph->Ribs[parentID].diameterCM;
					averageDiameter = graph->meanDiameterOnParentSegment(rib.ID, 15);
				else // has no parent or child
					averageDiameter = rib.diameterCM;
			}
			else {
				if (rib.marker == FLOW3D) {
					averageDiameter = 0;
					double numOfNeighbours = 0; // 0(no parent or child ), 1(parent or child) or 2 (parent+child)
					if (childID > 0) {
						if (graph->Ribs[childID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnChildSegment(rib.ID, 15);
						}
					}
					if (parentID > 0) {
						if (graph->Ribs[parentID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, 15);
						}
					}
					if (numOfNeighbours > 0)
						averageDiameter *= (1.0 - rib.stenosisPersent) / numOfNeighbours;
					else
						averageDiameter = rib.diameterCM;
				}
				else {
					averageDiameter = rib.diameterCM;
					if (rib.marker == STENOSIS)
						averageDiameter *= (1.0 - rib.stenosisPersent);
				}
			}
			graphGV << "\\ndiam = " << averageDiameter << "cm\"";

			if (rib.marker == 0) // regular vessel
				graphGV << "];\n";
			else if (rib.marker == 1) // stenosis
				graphGV << "penwidth=7];\n";
			else if (rib.marker == 2) // stent
				graphGV << "style=bold];\n";
			else if (rib.marker == 3) // flow 3D
				graphGV << "style=dashed];\n";
		}
	}
	graphGV << "}\n";
	graphGV.close();
	return;






	*/



	ofstream ffrout;
	ffrout.open(".\\FFR\\input_data.tre");
	wostringstream ws;

	log << "Printing rib and node counts\n";
	int allRibsCount = graph->Ribs.size();
	int allNodesCount = graph->Nodes.size();

	ws << allNodesCount << L"\r\n" << allRibsCount << L"\r\n";
	ffrout << allNodesCount << endl << allRibsCount << endl;

	/*
	ws << L"NODES \r\n";
	for (auto node= lt->newGraphNodes.begin(); node!=lt->newGraphNodes.end(); ++node)
	{
	ws << (*node).ID << L" " << (*node).reorderedID << L" " << (*node).degree << L"\r\n" << "incident ribs ";
	for (auto i=0; i<(*node).incidentRibsID.size(); i++)
	ws <<(*node).incidentRibsID[i] << L" ";
	ws << L"\r\n";
	}
	ws << "RIBS" << L"\r\n";
	for (auto rib= lt->newGraphRibs.begin(); rib!=lt->newGraphRibs.end(); ++rib)
	ws << (*rib).ID << L" " << (*rib).reorderedID << L" " << (*rib).firstEndID << L" " << (*rib).secondEndID <<L"\r\n";

	ws << lt->StenosisPaths.size() << L" PATHS" <<L"\r\n";
	for (i=0; i<lt->StenosisPaths.size(); i++)
	{
	ws << L"path ";
	for (auto j=0; j<lt->StenosisPaths[i].size(); ++j)
	ws << lt->StenosisPaths[i][j] << L" " ;
	ws << L"\r\n";
	}
	ws << L"\r\n";
	*/
#ifdef PERIVASCULAR
	for (int ii = 0; ii < graph->TerminalPaths.size(); ii++)
		if (graph->terminalPathLabels[ii] == 2) {
			processor->vtb->findCenterlineMeanIntensitiesAround(graph->TerminalPaths[ii]);
			break;
		}
#endif // PERIVASCULAR

	double vsize_cm[3];

	vsize_cm[0] = .1 * processor->vtb->vsize[0];
	vsize_cm[1] = .1 * processor->vtb->vsize[1];
	vsize_cm[2] = .1 * processor->vtb->vsize[2];








	log << "\nprinting left nodes";
	// узлы левой ветви
	if (graph->LeftNodes.size() > 0) {
		// число узлов
		ws << graph->LeftNodes.size() << L"\r\n";
		ffrout << graph->LeftNodes.size() << endl;

		for (i = 0; i < graph->LeftNodes.size(); ++i) {
			auto node = graph->Nodes[graph->LeftNodes[i]];
			// knot number \n
			ws << i + 1 << L"\r\n";
			ffrout << i + 1 << endl;
			if (i == 0)
				graphGV << "L_" << i + 1 << "_" << node.ID << " [color=red, shape=box];\n";
			else
				graphGV << "L_" << i + 1 << "_" << node.ID << " [color=red];\n";

			// knot coordinates \n
			ws << node.x * vsize_cm[0] << L" " << node.y * vsize_cm[1] << L" " << node.z * vsize_cm[2] << L"\r\n";
			ffrout << node.x * vsize_cm[0] << " " << node.y * vsize_cm[1] << " " << node.z * vsize_cm[2] << endl;
			// if leaf print 1, else print 2 \n
			if (node.degree == 1) {
				ws << L"2 \r\n";
				ffrout << "2" << endl;
			} else {
				ws << L"1 \r\n";
				ffrout << "1" << endl;
			}
		}
	} else {
		ws << L"0 \r\n";
		ffrout << "0" << endl;
	}

	log << "\nprinting right nodes";
	// узлы правой ветви
	if (graph->RightNodes.size() > 0) {
		ws << graph->RightNodes.size() << L"\r\n";
		ffrout << graph->RightNodes.size() << endl;
		for (i = 0; i < graph->RightNodes.size(); ++i) {
			auto node = graph->Nodes[graph->RightNodes[i]];
			// knot number \n
			ws << i + 1 << L"\r\n";
			ffrout << i + 1 << endl;
			if (i == 0)
				graphGV << "R_" << i + 1 << "_" << node.ID << " [color=blue, shape=box];\n";
			else
				graphGV << "R_" << i + 1 << "_" << node.ID << " [color=blue];\n";

			// knot coordinates \n
			ws << node.x * vsize_cm[0] << L" " << node.y * vsize_cm[1] << L" " << node.z * vsize_cm[2] << L"\r\n";
			ffrout << node.x * vsize_cm[0] << " " << node.y * vsize_cm[1] << " " << node.z * vsize_cm[2] << endl;
			// if leaf print 1, else print 2 \n
			if (node.degree == 1) {
				ws << L"2 \r\n";
				ffrout << "2" << endl;
			} else {
				ws << L"1 \r\n";
				ffrout << "1" << endl;
			}
		}
	} else {
		ws << L"0 \r\n";
		ffrout << "0" << endl;
	}
	// сегменты левой ветви

	// cntl для извитостей
#ifdef PRINT_CENTERLINE
	ofstream cntl; cntl.open("centerline_info.txt");
	cntl << graph->LeftRibs.size();
#ifndef CEREBRAL_VESSELS
	cntl << " " << graph->RightRibs.size();
#endif 
	cntl << endl;
#endif

	log << "\nprinting left edges";
	if (graph->LeftRibs.size() > 0) {
		ws << graph->LeftRibs.size() << L"\r\n";
		ffrout << graph->LeftRibs.size() << endl;
		for (i = 0; i < graph->LeftRibs.size(); ++i) {
			auto rib = graph->Ribs[graph->LeftRibs[i]];
			ws << i + 1 << L"\r\n"; // segment number \n
			ffrout << i + 1 << endl;

#ifdef PRINT_CENTERLINE  
			cntl << i + 1 << " " << rib.points.size() << endl;
			for (auto p = rib.points.begin(); p != rib.points.end(); p++)
				cntl << (*p)[0] * vsize_cm[0] << " " << (*p)[1] * vsize_cm[1] << " " << (*p)[2] * vsize_cm[2]
				<< " " << 0.2 * thinner->findRadius(*p, 1) << endl;
#endif
			// start_node_index end_node_index \n
			int beginID = graph->Nodes[rib.firstEndID].labelID + 1;
			int endID = graph->Nodes[rib.secondEndID].labelID + 1;
			if (beginID > endID) {
				ws << endID << L" " << beginID << L"\r\n";
				ffrout << endID << " " << beginID << endl;
				graphGV << "L_" << endID << "_" << graph->Nodes[rib.secondEndID].ID
					<< " -- L_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " [color=";
				if (rib.isGapRib)
					graphGV << "grey";
				else
					graphGV << "red";
				graphGV << ", label=\"" << i + 1 << "_" << rib.ID;
			} else {
				ws << beginID << L" " << endID << L"\r\n";
				ffrout << beginID << " " << endID << endl;
				graphGV << "L_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " -- L_" << endID << "_" << graph->Nodes[rib.secondEndID].ID << " [color=";
				if (rib.isGapRib) {
					if (rib.marker == STENT)
						graphGV << "\"grey:invis:grey\"";
					else
						graphGV << "grey";
				} else {
					if (rib.marker == STENT)
						graphGV << "\"red:invis:red\"";
					else
						graphGV << "red";

				}
				graphGV << ", label=\"" << i + 1 << "_" << rib.ID;
			}

			// segment length \n
			double segmentLength = 0.1 * thinner->getSegmentLength(rib.points, 4);
			ws << segmentLength << L"\r\n";
			ffrout << segmentLength << endl;
			graphGV << "\\nlen = " << segmentLength << "cm";
			int parentID = graph->Ribs[graph->LeftRibs[i]].parentRib;
			int childID = graph->Ribs[graph->LeftRibs[i]].childRib;
			graphGV << "\\nparent = " << parentID;
			graphGV << "\\nchild = " << childID;
			// segment average raduis \n
			double averageDiameter = 0;
			if (rib.isGapRib) {
				if (childID >= 0) {// has child
					//averageDiameter = graph->Ribs[childID].diameterCM;
					averageDiameter = graph->meanDiameterOnChildSegment(rib.ID, 15);
					if (parentID >= 0) {
						if (2 == graph->Nodes[graph->findGraphNodeBetweenRibs(rib.ID, parentID)].degree) {
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, parentID);
							averageDiameter /= 2.0;
						}
					}
				} else if (parentID >= 0) // has no child but parent
					//averageDiameter = graph->Ribs[parentID].diameterCM;
					averageDiameter = graph->meanDiameterOnParentSegment(rib.ID, 15);
				else // has no parent or child
					averageDiameter = rib.diameterCM;
				if (rib.marker == FLOW3D || rib.marker == STENOSIS)
					averageDiameter *= (1.0 - rib.stenosisPersent);

			} else {
				if (rib.marker == FLOW3D) {
					averageDiameter = 0;
					double numOfNeighbours = 0; // 0(no parent or child ), 1(parent or child) or 2 (parent+child)
					if (childID > 0) {
						if (graph->Ribs[childID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnChildSegment(rib.ID, 15);
							//averageDiameter += graph->Ribs[childID].diameterCM;
						}
					}
					if (parentID > 0) {
						if (graph->Ribs[parentID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, 15);
							//averageDiameter += graph->Ribs[parentID].diameterCM;
						}
					}
					if (numOfNeighbours > 0)
						averageDiameter *= (1.0 - rib.stenosisPersent) / numOfNeighbours;
					else
						averageDiameter = rib.diameterCM;
				} else {
					averageDiameter = rib.diameterCM;
					if (rib.marker == STENOSIS)
						averageDiameter *= (1.0 - rib.stenosisPersent);
				}
			}

			ws << averageDiameter << L"\r\n";
			ffrout << averageDiameter << endl;
			graphGV << "\\ndiam = " << averageDiameter << "cm\"";
			if (rib.marker == REGULAR) // regular vessel
				graphGV << "];\n";
			else if (rib.marker == STENOSIS) // stenosis
				graphGV << "penwidth=7];\n";
			else if (rib.marker == STENT) // stent
				graphGV << "style=bold];\n";
			else if (rib.marker == FLOW3D) // flow 3D
				graphGV << "style=dashed];\n";
			// 10 \n
			ws << L"10 \r\n";
			ffrout << "10" << endl;
		}
	} else {
		ws << L"0 \r\n";
		ffrout << "0" << endl;
	}
	log << "\nprinting right edges";
	// сегменты правой ветви
	if (graph->RightRibs.size() > 0) {
		ws << graph->RightRibs.size() << L"\r\n";
		ffrout << graph->RightRibs.size() << endl;
		for (i = 0; i < graph->RightRibs.size(); ++i) {

			auto rib = graph->Ribs[graph->RightRibs[i]];
			ws << i + 1 << L"\r\n"; // segment number \n
			ffrout << i + 1 << endl;

#ifdef PRINT_CENTERLINE 
			cntl << i + 1 << " " << rib.points.size() << endl;
			for (auto p = rib.points.begin(); p != rib.points.end(); p++)
				cntl << (*p)[0] * vsize_cm[0] << " " << (*p)[1] * vsize_cm[1] << " " << (*p)[2] * vsize_cm[2]
				<< " " << 0.2 * thinner->findRadius(*p, 1) << endl;
#endif
			// start_node_index end_node_index \n
			int beginID = graph->Nodes[rib.firstEndID].labelID + 1;
			int endID = graph->Nodes[rib.secondEndID].labelID + 1;
			if (beginID > endID) {
				ws << endID << L" " << beginID << L"\r\n";
				ffrout << endID << " " << beginID << endl;
				graphGV << "R_" << endID << "_" << graph->Nodes[rib.secondEndID].ID
					<< " -- R_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " [color=";
				if (rib.isGapRib)
					graphGV << "grey";
				else
					graphGV << "blue";
				graphGV << ", label=\"" << i + 1 << "_" << rib.ID;
			} else {
				ws << beginID << L" " << endID << L"\r\n";
				ffrout << beginID << " " << endID << endl;
				graphGV << "R_" << beginID << "_" << graph->Nodes[rib.firstEndID].ID
					<< " -- R_" << endID << "_" << graph->Nodes[rib.secondEndID].ID
					<< " [color=";

				if (rib.isGapRib) {
					if (rib.marker == STENT)
						graphGV << "\"grey:invis:grey\"";
					else
						graphGV << "grey";
				} else {
					if (rib.marker == STENT)
						graphGV << "\"blue:invis:blue\"";
					else
						graphGV << "blue";

				} graphGV << ", label=\"" << i + 1 << "_" << rib.ID;

			}

			// segment length \n
			double segmentLength = 0.1 * thinner->getSegmentLength(rib.points, 4);
			ws << segmentLength << L"\r\n";
			ffrout << segmentLength << endl;
			graphGV << "\\nlen = " << segmentLength << "cm";
			int parentID = graph->Ribs[graph->RightRibs[i]].parentRib;
			int childID = graph->Ribs[graph->RightRibs[i]].childRib;
			graphGV << "\\nparent = " << parentID;
			graphGV << "\\nchild = " << childID;

			// segment average raduis \n
			double averageDiameter = 0;
			if (rib.isGapRib) {
				if (childID >= 0) { // has child
					//averageDiameter = graph->Ribs[childID].diameterCM;
					averageDiameter = graph->meanDiameterOnChildSegment(rib.ID, 15);
					if (parentID >= 0) {
						if (2 == graph->Nodes[graph->findGraphNodeBetweenRibs(rib.ID, parentID)].degree) {
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, parentID);
							averageDiameter /= 2.0;
						}
					}
				} else if (parentID >= 0) // has no child but parent
					//averageDiameter = graph->Ribs[parentID].diameterCM;
					averageDiameter = graph->meanDiameterOnParentSegment(rib.ID, 15);
				else // has no parent or child
					averageDiameter = rib.diameterCM;
				if (rib.marker == FLOW3D || rib.marker == STENOSIS)
					averageDiameter *= (1.0 - rib.stenosisPersent);
			} else {
				if (rib.marker == FLOW3D) {
					averageDiameter = 0;
					double numOfNeighbours = 0; // 0(no parent or child ), 1(parent or child) or 2 (parent+child)
					if (childID > 0) {
						if (graph->Ribs[childID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnChildSegment(rib.ID, 15);
							//averageDiameter += graph->Ribs[childID].diameterCM;
						}
					}
					if (parentID > 0) {
						if (graph->Ribs[parentID].marker == REGULAR) {
							numOfNeighbours += 1;
							averageDiameter += graph->meanDiameterOnParentSegment(rib.ID, 15);
							//averageDiameter += graph->Ribs[parentID].diameterCM;
						}
					}
					if (numOfNeighbours > 0)
						averageDiameter *= (1.0 - rib.stenosisPersent) / numOfNeighbours;
					else
						averageDiameter = rib.diameterCM;
				} else {
					averageDiameter = rib.diameterCM;
					if (rib.marker == STENOSIS)
						averageDiameter *= (1.0 - rib.stenosisPersent);
				}
			}
			/*
				for (auto j = 0; j < rib.points.size(); ++j)
					averageRadius += 0.2*thinner->findRadius(rib.points[j], 1);
				averageRadius /= rib.points.size();
				if (rib.marker == STENOSIS)
					averageRadius *= (1.0 - rib.stenosisPersent);
			*/
			ws << averageDiameter << L"\r\n";
			ffrout << averageDiameter << endl;
			graphGV << "\\ndiam = " << averageDiameter << "cm\"";

			if (rib.marker == 0) // regular vessel
				graphGV << "];\n";
			else if (rib.marker == 1) // stenosis
				graphGV << "penwidth=7];\n";
			else if (rib.marker == 2) // stent
				graphGV << "style=bold];\n";
			else if (rib.marker == 3) // flow 3D
				graphGV << "style=dashed];\n";
			// 10 \n
			ws << L"10 \r\n";
			ffrout << "10" << endl;
		}
	} else {
		ws << L"0 \r\n";
		ffrout << "0" << endl;
	}

	log << "\nprinting stenosis info";

	// TODO модифицировать печать стенозов
	ws << stenosisCount << L"\r\n";
	ffrout << stenosisCount << endl;

	int pathInd = 0;
	vector <int> path;

	for (i = 0; i < stenosisCount; ++i) {
		int maxStenosisSegment = 0;
		path = graph->StenosisPaths[i];
		for (int j = 0; j < path.size(); j++)
			if (graph->Ribs[path[j]].labelID > maxStenosisSegment)
				maxStenosisSegment = graph->Ribs[path[j]].labelID;

		//double stenosisArea = (2.*stenosis[i].Center.Area + stenosis[i].Front.Area + stenosis[i].Rear.Area) /4;

		ws << graph->Ribs[graph->StenosisPaths[i][0]].branchLabel << L"\r\n"
			<< maxStenosisSegment + 1 << L"\r\n"
			<< stenosis[i].StenosisType + 1 << L"\r\n";
		ffrout << graph->Ribs[graph->StenosisPaths[i][0]].branchLabel << endl
			<< maxStenosisSegment + 1 << endl
			<< stenosis[i].StenosisType + 1 << endl;
	}

#ifdef PRINT_LOG_INTEROP
	ofstream stenosisPathsLog;
	stenosisPathsLog.open("log_StenosisPaths.txt");
	for (auto it = graph->StenosisPaths.begin(); it != graph->StenosisPaths.end(); it++) {
		for (auto iit = it->begin(); iit != it->end(); iit++)
			stenosisPathsLog << (*iit) << " (" << graph->Ribs[*iit].labelID << "), ";
		stenosisPathsLog << endl;
	}
	stenosisPathsLog.close();
#endif

	graphGV << "}\n";
	graphGV.close();
	ffrout.close();
	wstring ss(ws.str());
	writer(&ss[0]);
#ifdef PRINT_CENTERLINE
	cntl.close();
#endif
	log << "\ndone!";
	log.close();

}


void writePath(std::string path) {
    tracer.log("writePath()");
    ofstream o("path.txt");
	o << path << std::endl;
}
#endif
