#include "stdafx.h"
#include "vtb.hpp"
#include "hessian_filters.hpp"
#include "imgaussian.hpp"
#include <math.h>
//#include "tracer.h"

using namespace std;

#include "configuration.h"

void FFRService_update_progres(float relativeProgress, const wchar_t* status);  // forward declaration

VTB::VTB() {
	manualVesselsCount = 0;
	thinner = nullptr;
	Image = nullptr;
	Vesselness = nullptr;
	parameters = nullptr;
	vesselComponents = nullptr;
	aortaMask = nullptr;
	idt = nullptr;
	nearAortaMask = nullptr;
	vesselnessCutMask = nullptr;
	nonvesselnessMask = nullptr;
	thinner = nullptr;
	graph = nullptr;
	reversedX = reversedY = 0;

	ostia1 = -1;
	ostia2 = -1;
	rightOstia = -1;
	leftOstia = -1;
	userSeedPointsCount = 0;
	parameters = new VTBParameters;


	//initializeVTBParameters();

	  //tempFunction();
	  //extractBronchi();
	  //extractCoronaryVessels();
	  //extractCerebralVessels();
}


void VTB::InitializeThinner() {
	thinner = new Thinner(vesselComponents, dim, vsize);
}


void VTB::InitializeGraph() {
	graph = new Graph(thinner);
}


void VTB::loadManualSegmentation(std::string left_filename, std::string right_filename, double* left_ostium, double* right_ostium) {
	// read manual segmented images into vesselComponents
	// up to 2 branches in case of coronary arteries 
	// up to 1 bracnh in case of cerebral arteries
	if (vesselComponents == nullptr) {
		try {
			vesselComponents = new short[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Bad Alloc VTB vesselComponents");
		}
	}
	for (auto i = 0; i < n; i++)
		vesselComponents[i] = 0;

	unsigned long long ind, voxelCount;

	ifstream lb;

	lb.open(left_filename);
	leftOstia = getIndex(left_ostium[0], left_ostium[1], left_ostium[2]);
	lb >> voxelCount;
	for (auto i = 0; i < voxelCount; i++) {
		lb >> ind;
		//processor->vtb->leftBranchMask[ind]=1;
		unsigned long long x = ind % dim[0];
		unsigned long long y = ind / dim[0] % dim[1];
		unsigned long long z = ind / dim[0] / dim[1];
		vesselComponents[getIndex(x, y, dim[2] - 1 - z)] = 1;
	}
	lb.close();
#ifndef CEREBRAL_VESSELS 

	ifstream rb(right_filename);
	rb >> voxelCount;
	rightOstia = getIndex(right_ostium[0], right_ostium[1], right_ostium[2]);

	for (auto i = 0; i < voxelCount; i++) {
		rb >> ind;
		//processor->vtb->vesselComponents[ind]=1;

		int x = ind % dim[0];
		int y = ind / dim[0] % dim[1];
		int z = ind / dim[0] / dim[1];
		vesselComponents[getIndex(x, y, dim[2] - 1 - z)] = 2;
	}
	rb.close();
#endif // CEREBRAL_VESSELS
}

void VTB::updateAortaCut(double tau) {
	idt->getPartitionByPercent(tau);

    for (auto i = 0; i < n; ++i) {
#ifdef CUT_DECSENDING_AORTA
        if (i / dim[0] % dim[1] < 300)
			aortaMask[i] = idt->resulting_mask[i];
		else
			aortaMask[i] = 0;
#else
//		aortaMask[i] = idt->resulting_mask[i];
#endif //CUT_DECSENDING_AORTA
    }
    memcpy(aortaMask,idt->resulting_mask,n);
}


VTB::~VTB() {
	if (Image != nullptr) { delete[] Image; Image = nullptr; }
	delete Image3D;
	if (idt != nullptr) { delete idt; idt = nullptr; }
	if (aortaMask != nullptr) { delete[] aortaMask; aortaMask = nullptr; }
	if (vesselComponents != nullptr) { delete[] vesselComponents; vesselComponents = nullptr; }
	if (nearAortaMask != nullptr) { delete[] nearAortaMask; nearAortaMask = nullptr; }
	if (Vesselness != nullptr) { delete[] Vesselness; Vesselness = nullptr; }
	if (parameters != nullptr) { delete[] parameters; parameters = nullptr; }
	if (vesselnessCutMask != nullptr) { delete[]vesselnessCutMask; vesselnessCutMask = nullptr; }
	if (nonvesselnessMask != nullptr) { delete[] nonvesselnessMask; nonvesselnessMask = nullptr; }
	if (graph != nullptr) { delete graph; graph = nullptr; }
	if (thinner != nullptr) { delete thinner; thinner = nullptr; };
	userMarkedVessels.clear();
}


void VTB::regrowUserSeeds() {
	userMarkedVessels.clear();
	auto ft = parameters->frangiThreshold;
	vector <unsigned long long> vessel;
	set <unsigned long long> front;

	for (auto i = 0; i < userSeedPoints.size(); i++) {
		auto seed = getIndex(userSeedPoints[i][0], userSeedPoints[i][1], userSeedPoints[i][2]);

		vessel.clear();
		if (vesselComponents[seed] || Vesselness[seed] <= ft) {
			//Если компонента уже выделена или точка вне сосуда, то формально добавляем пустой сосуд
			userMarkedVessels.push_back(vessel);
			return;
		}

		int componentNo = i + 3;

		if (Vesselness[seed] > ft) {
			vesselComponents[seed] = componentNo;
			front.insert(seed);
			vessel.push_back(seed);
		}

		bool notLastX, notLastY, notLastZ;
		bool notFirstX, notFirstY, notFirstZ;
		while (!front.empty()) {
			notFirstX = notFirstY = notFirstZ = false;
			notLastX = notLastY = notLastZ = false;
			unsigned long long coord = *front.begin();

			if (!(coord < dim[0] * dim[1])) notFirstZ = true;
			if (!((coord / dim[0]) % dim[1] == 0)) notFirstY = true;
			if (!(coord % dim[0] == 0)) notFirstX = true;
			if (!(coord % dim[0] == dim[0] - 1)) notLastX = true;
			if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) notLastY = true;
			if (!(coord >= dim[0] * dim[1] * (dim[2] - 1)))	notLastZ = true;

			if (notFirstZ) { // 0 0 -
				auto nbr = coord - dim[0] * dim[1];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notFirstY) { // 0 - -
					nbr = coord - dim[0] * (dim[1] + 1);
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					if (notFirstX) { // - - -
						nbr = coord - dim[0] * (dim[1] + 1) - 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}  if (notLastX) {// + - -
						nbr = coord - dim[0] * (dim[1] + 1) + 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}
				}
				if (notLastY) { // 0 + -
					nbr = coord - dim[0] * (dim[1] - 1);
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					if (notFirstX) { // - + -
						nbr = coord - dim[0] * (dim[1] - 1) - 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}  if (notLastX) {// + + -
						nbr = coord - dim[0] * (dim[1] - 1) + 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}
				}
			}
			if (notFirstY) { // 0 - 0
				auto nbr = coord - dim[0];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			}
			if (notFirstX) {// - 0 0
				auto nbr = coord - 1;
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notLastY) { // - + 0
					nbr = coord - 1 + dim[0];
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
				if (notFirstY) { // - - 0
					nbr = coord - 1 - dim[0];
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
			}
			if (notLastX) { // + 0 0
				auto nbr = coord + 1;
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notLastY) { // + + 0
					nbr = coord + 1 + dim[0];
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
				if (notFirstY) { // + - 0
					nbr = coord + 1 - dim[0];
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
			}
			if (notLastY) { // 0 + 0
				auto nbr = coord + dim[0];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			}
			if (notLastZ) { // 0 0 +
				auto nbr = coord + dim[0] * dim[1];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notFirstY) { // 0 - +
					nbr = coord + dim[0] * (dim[1] - 1);
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					if (notFirstX) { // - - +
						nbr = coord + dim[0] * (dim[1] - 1) - 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}  if (notLastX) {// + - +
						nbr = coord + dim[0] * (dim[1] - 1) + 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}
				}
				if (notLastY) { // 0 + +
					nbr = coord + dim[0] * (dim[1] - 1);
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					if (notFirstX) { // - + +
						nbr = coord + dim[0] * (dim[1] + 1) - 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}  if (notLastX) {// + + +
						nbr = coord + dim[0] * (dim[1] + 1) + 1;
						if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
					}
				}
			}
		}
		userMarkedVessels.push_back(vessel);
	}
}
//Rewritten
//TODO check
void VTB::addUserVessel(unsigned long long seed) {
	if (vesselComponents == nullptr) {
		try {
			vesselComponents = new short[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.vesselComponents");
		}
		for (auto i = 0; i < n; ++i)
			vesselComponents[i] = 0;
		userMarkedVessels.clear();
	}
	auto ft = parameters->frangiThreshold;
	vector <unsigned long long> vessel;
	set <unsigned long long> front;
	vessel.clear();
	if (vesselComponents[seed] || Vesselness[seed] <= ft) {
		//Если компонента уже выделена или точка вне сосуда, то формально добавляем пустой сосуд
		userMarkedVessels.push_back(vessel);
		return;
	}

	int componentNo = userMarkedVessels.size() + 3;

	if (Vesselness[seed] > ft) {
		vesselComponents[seed] = componentNo;
		front.insert(seed);
		vessel.push_back(seed);
	}
	bool notLastX, notLastY, notLastZ;
	bool notFirstX, notFirstY, notFirstZ;
	while (!front.empty()) {
		notFirstX = notFirstY = notFirstZ = false;
		notLastX = notLastY = notLastZ = false;
		unsigned long long coord = *front.begin();

		front.erase(front.begin());
		if (!(coord < dim[0] * dim[1])) notFirstZ = true;
		if (!((coord / dim[0]) % dim[1] == 0)) notFirstY = true;
		if (!(coord % dim[0] == 0)) notFirstX = true;
		if (!(coord % dim[0] == dim[0] - 1)) notLastX = true;
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) notLastY = true;
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1)))	notLastZ = true;



		if (notFirstZ) { // 0 0 -
			auto nbr = coord - dim[0] * dim[1];
			if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			if (notFirstY) { // 0 - -
				nbr = coord - dim[0] * (dim[1] + 1);
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notFirstX) { // - - -
					nbr = coord - dim[0] * (dim[1] + 1) - 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}  if (notLastX) {// + - -
					nbr = coord - dim[0] * (dim[1] + 1) + 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
			}
			if (notLastY) { // 0 + -
				nbr = coord - dim[0] * (dim[1] - 1);
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notFirstX) { // - + -
					nbr = coord - dim[0] * (dim[1] - 1) - 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}  if (notLastX) {// + + -
					nbr = coord - dim[0] * (dim[1] - 1) + 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
			}
		}
		if (notFirstY) { // 0 - 0
			auto nbr = coord - dim[0];
			if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
		}
		if (notFirstX) {// - 0 0
			auto nbr = coord - 1;
			if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			if (notLastY) { // - + 0
				nbr = coord - 1 + dim[0];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			}
			if (notFirstY) { // - - 0
				nbr = coord - 1 - dim[0];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			}
		}
		if (notLastX) { // + 0 0
			auto nbr = coord + 1;
			if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			if (notLastY) { // + + 0
				nbr = coord + 1 + dim[0];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			}
			if (notFirstY) { // + - 0
				nbr = coord + 1 - dim[0];
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			}
		}
		if (notLastY) { // 0 + 0
			auto nbr = coord + dim[0];
			if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
		}
		if (notLastZ) { // 0 0 +
			auto nbr = coord + dim[0] * dim[1];
			if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
			if (notFirstY) { // 0 - +
				nbr = coord + dim[0] * (dim[1] - 1);
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notFirstX) { // - - +
					nbr = coord + dim[0] * (dim[1] - 1) - 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}  if (notLastX) {// + - +
					nbr = coord + dim[0] * (dim[1] - 1) + 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
			}
			if (notLastY) { // 0 + +
				nbr = coord + dim[0] * (dim[1] - 1);
				if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				if (notFirstX) { // - + +
					nbr = coord + dim[0] * (dim[1] + 1) - 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}  if (notLastX) {// + + +
					nbr = coord + dim[0] * (dim[1] + 1) + 1;
					if (Vesselness[nbr] > ft && !vesselComponents[nbr]) { vesselComponents[nbr] = componentNo; vessel.push_back(nbr); front.insert(nbr); }
				}
			}
		}
	}

	userMarkedVessels.push_back(vessel);

	ofstream ofs;
	ofs.open("log_addUserVessel.txt");
	for (auto it = vessel.begin(); it != vessel.end(); ++it) {
		ofs << (*it) << " " << vesselComponents[*it] << nearAortaMask[*it] << "\n";
	}
	ofs.close();
}


//Rewritten
//TODO check
void VTB::popUserVessel() {
	assert(!userMarkedVessels.empty());
	auto vessel = *(userMarkedVessels.end() - 1);
	ofstream ofs;
	ofs.open("log_pop.txt");
	ofs << "userMarkedVessels.size() =  " << userMarkedVessels.size() << endl;
	ofs << userMarkedVessels[0].size() << " " << userMarkedVessels[1].size() << endl;
	if (!vessel.empty()) {
		for (auto it = vessel.begin(); it != vessel.end(); it++) {
			ofs << "ind " << *it << ", val = " << vesselComponents[*it] << ", expected val = " << userMarkedVessels.size() + 2 << endl;
			if (vesselComponents[*it] == userMarkedVessels.size() + 2)
				vesselComponents[*it] = 0;
		}
	}
	userMarkedVessels.pop_back();
	ofs << "userMarkedVessels.size() =  " << userMarkedVessels.size() << endl;
	ofs.close();
}


void VTB::initializeNonvesselnessMask(short threshold, float kernelSize) {
	bool* masktmp;
	try {
		masktmp = new bool[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.masktmp");
	}
	if (nonvesselnessMask == nullptr) {
		try {
			nonvesselnessMask = new short[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.nonvesselnessMask");
		}
	}
	for (auto i = 0; i < n; i++) {
		nonvesselnessMask[i] = 0;
		masktmp[i] = false;
		if (Image[i] > threshold) {
			nonvesselnessMask[i] = 255;
			masktmp[i] = true;
		}
	}

	//printMaskOnMHD("beforeSmoothing", nonvesselnessMask);

	smoothMask((unsigned)(5.5 / vsize[0]), (unsigned)(5.5 / vsize[0]), masktmp);
	for (auto i = 0; i < n; i++)
		if (!masktmp[i])
			nonvesselnessMask[i] = 0;
	delete[] masktmp;
	//printMaskOnMHD("afterSmoothing", nonvesselnessMask);
	/*
	float * filteredMask = new float[n];
	GaussianFiltering3D(nonvesselnessMask, filteredMask, dim, kernelSize, kernelSize * 6);
	for (auto i = 0; i < n; i++)
		nonvesselnessMask[i] = (short) floor(filteredMask[i]);
	delete[] filteredMask;
	*/
}

//Rewritten
//TODO check
void VTB::removeNearAortaVesselLeaks(unsigned* dmap, unsigned layers_size) {
	// Removes leaks in vesselComponents
	assert(vesselComponents);
	assert(aortaMask);
	vector<vector<int> > N26;
	vector<int> coord(3, 0);
	for (int i = -1; i < 2; ++i)
		for (int ii = -1; ii < 2; ++ii)
			for (int iii = -1; iii < 2; ++iii) {
				int s = abs(i) + abs(ii) + abs(iii);
				if (s > 0) {
					coord[0] = i;
					coord[1] = ii;
					coord[2] = iii;
					N26.push_back(coord);
				}
			}

	unsigned long long i, nbr_ind;
	int x, y, z;
	bool flag;
	getDistanceMap(aortaMask, dmap, 1);

	int dimx = int(dim[0]);
	int dimy = int(dim[1]);
	int dimz = int(dim[2]);

	vector< vector<unsigned long long> > Layers(layers_size);
	for (i = 0; i < n; ++i)
		if (vesselComponents[i])
			if (dmap[i] <= layers_size && dmap[i] > 0)
				Layers[dmap[i] - 1].push_back(i);

	int removedCount = 0;
	for (unsigned j = layers_size; j >= 1; --j)
		for (unsigned i = 0; i < Layers[j - 1].size(); ++i) {
			flag = 1;
			for (unsigned k = 0; k < 26; ++k) {
				x = Layers[j - 1][i] % dim[0];
				y = (Layers[j - 1][i] / dim[0]) % dim[1];
				z = Layers[j - 1][i] / (dim[0] * dim[1]);

				x += N26[k][0]; y += N26[k][1]; z += N26[k][2];
				if (x < 0 || x >= dimx || y < 0 || y >= dimy || z < 0 || z >= dimz)
					continue;
				nbr_ind = x + dim[0] * (y + dim[1] * z);
				if (dmap[nbr_ind] > j) {
					if (vesselComponents[nbr_ind]) {
						flag = 0;
						break;
					} else
						flag = 1;
				}
			}
			if (flag) {
				vesselComponents[Layers[j - 1][i]] = 0;
				removedCount++;
			}
		}
	N26.clear();
}

void VTB::findCenterlineMeanIntensitiesAround(vector <vector<int> >& cnt) {
	vector< vector < pair<short, double> > > output(cnt.size());
	bool* cntMask;
	try {
		cntMask = new bool[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad alloc VTB.cntMask");
	}
	for (auto i = 0; i < cnt.size(); i++) {
		cntMask[getIndex(cnt[i][0], cnt[i][1], cnt[i][2])] = 1;
	}

	unsigned* dmap;
	try {
		dmap = new unsigned[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad alloc VTB.dmap");
	}
	getDistanceMap(cntMask, dmap, 1);

	for (auto i = 0; i < n; i++) {
		if (Image[i] < -190 || Image[i]> -30)
			continue;
		if (dmap[i] > 35)
			continue;
		int x = i % dim[0];
		int y = i / dim[0] % dim[1];
		int z = i / (dim[0] * dim[1]);

		// find nearest centerline point
		double minDist = 1e+20;
		int nearestCntPoint = -1;
		for (auto i = 0; i < cnt.size(); i++) {
			double currentDist = (cnt[i][0] - x) * (cnt[i][0] - x) + (cnt[i][1] - y) * (cnt[i][1] - y) + (cnt[i][2] - z) * (cnt[i][2] - z);
			if (currentDist < minDist) {
				minDist = currentDist;
				nearestCntPoint = i;
			}
		}
		output[nearestCntPoint].push_back(make_pair(dmap[i], Image[i]));
	}
	delete[] dmap;
	delete[] cntMask;

	ofstream o;
	o.open("perivascular.txt");
	for (auto i = 0; i < output.size(); i++) {
		for (int j = 0; j < output[i].size(); j++)
			o << i << " " << output[i][j].first << " " << output[i][j].second << "\n";
	}
	o.close();
	output.clear();
}

void VTB::removeNearAortaVesselLeaks(unsigned* dmap, bool* vesselMask, unsigned layers_size) {
	assert(aortaMask);
	vector<vector<int> > N26;
	vector<int> coord(3, 0);
	for (int i = -1; i < 2; ++i)
		for (int ii = -1; ii < 2; ++ii)
			for (int iii = -1; iii < 2; ++iii) {
				int s = abs(i) + abs(ii) + abs(iii);
				if (s > 0) {
					coord[0] = i;
					coord[1] = ii;
					coord[2] = iii;
					N26.push_back(coord);
				}
			}

	unsigned long long i, nbr_ind;
	int x, y, z;
	bool flag;
	getDistanceMap(aortaMask, dmap, 1);

	int dimx = int(dim[0]);
	int dimy = int(dim[1]);
	int dimz = int(dim[2]);

	vector< vector<unsigned long long> > Layers(layers_size);
	for (i = 0; i < n; ++i)
		if (vesselMask[i])
			if (dmap[i] <= layers_size && dmap[i] > 0)
				Layers[dmap[i] - 1].push_back(i);

	int removedCount = 0;
	for (unsigned j = layers_size; j >= 1; --j)
		for (unsigned i = 0; i < Layers[j - 1].size(); ++i) {
			flag = 1;
			for (unsigned k = 0; k < 26; ++k) {
				x = Layers[j - 1][i] % dim[0];
				y = (Layers[j - 1][i] / dim[0]) % dim[1];
				z = Layers[j - 1][i] / (dim[0] * dim[1]);

				x += N26[k][0]; y += N26[k][1]; z += N26[k][2];
				if (x < 0 || x >= dimx || y < 0 || y >= dimy || z < 0 || z >= dimz)
					continue;
				nbr_ind = x + dim[0] * (y + dim[1] * z);
				if (dmap[nbr_ind] > j) {
					if (vesselMask[nbr_ind]) {
						flag = 0;
						break;
					} else
						flag = 1;
				}
			}
			if (flag) {
				vesselMask[Layers[j - 1][i]] = 0;
				removedCount++;
			}
		}
	N26.clear();
}


/*
void VTB::removeNearAortaVesselLeaks(unsigned * dmap, bool * vesselMask)
{
  vector<vector<int> > N26;
  vector<int> coord(3,0);
  for (int i=-1; i<2; ++i)
	for (int ii=-1; ii<2; ++ii)
	  for (int iii=-1; iii<2; ++iii)
	  {
		int s = abs(i) + abs(ii) + abs(iii);
		if (s>0)
		{
		  coord[0] = i;
		  coord[1] = ii;
		  coord[2] = iii;
		  N26.push_back(coord);
		}
	  }

  unsigned long long i,nbr_ind;
  int x,y,z;
  bool flag;
  getDistanceMap (aortaMask, dmap, 1);

  int dimx = int(dim[0]);
  int dimy = int(dim[1]);
  int dimz = int(dim[2]);
  for (unsigned j=unsigned(round(6./vsize[0])); j>=1; --j)
  {
	unsigned long long count = 0;
	for (i=0; i<n; ++i)
	{
	  if (dmap[i]==j && vesselMask[i])
	  {
		//++count;
		flag=1;
		for (unsigned k=0; k<26; ++k)
		{
		  x = i%dim[0];
		  y = (i/dim[0])%dim[1];
		  z = i/(dim[0]*dim[1]);

		  x+=N26[k][0]; y+=N26[k][1]; z+=N26[k][2];
		  if (x<0||x>=dimx || y<0||y>=dimy || z<0||z>=dimz)
			continue;
		  nbr_ind = x+dim[0]*(y+dim[1]*z);
		  if (dmap[nbr_ind]>j)
		  {
			if (vesselMask[nbr_ind])
			{
			  flag=0;
			  break;
			}
			else
			  flag=1;
		  }
		}
		if (flag)
		{
		  ++count;
		  vesselMask[i]=0;
		}
	  }
	}
	cout << count << endl;
  }
  N26.clear();
}
*/

void VTB::tempFunction() {
	unsigned long long i;
	unsigned long long aorta_index;

	/*
	  vtkSmartPointer<vtkDICOMImageReader> reader =
		vtkSmartPointer<vtkDICOMImageReader>::New();
	  reader->SetDirectoryName(parameters->dirName);
		reader->Update();
	  vtkImageData *f = reader->GetOutput();

	  int dim_[3];
	  f->GetSpacing(vsize);
	  f->GetDimensions(dim_);
	  dim[0]=dim_[0]; dim[1]=dim_[1]; dim[2]=dim_[2];
	  n = f->GetNumberOfPoints();
	*/
	// хараманян
	//dim[0]=512;
	//dim[1]=512;
	//dim[2]=1339;
	//vsize[0]=0.976;
	//vsize[1]=0.976;
	//vsize[2]=1.;

  /*  // сычиков тело
	dim[0]=512;
	dim[1]=512;
	dim[2]=1264;
	vsize[0]=0.976;
	vsize[1]=0.976;
	vsize[2]=1.;
  */
  // сычиков ноги
	dim[0] = 512;
	dim[1] = 512;
	dim[2] = 730;
	vsize[0] = 0.976;
	vsize[1] = 0.976;
	vsize[2] = 1.;


	n = dim[0] * dim[1] * dim[2];

	if (vesselComponents != nullptr) { delete[] vesselComponents; vesselComponents = nullptr; }
	try {
		vesselComponents = new short[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.vesselComponents");
	}
	for (i = 0; i < n; ++i)
		vesselComponents[i] = 0;
	FILE* fin;
	int label;


	fin = fopen("sychikov_legs.txt", "r");

	//fin = fopen("neck_brekhovskikh.txt","r");
	for (i = 0; i < n; ++i) {
		fscanf(fin, "%d", &label);
		vesselComponents[i] = label;
	}
	fclose(fin);
	/*
	  if (Image) { delete[] Image; Image=0; }
	  Image = new short[n];

	  vtkShortArray* array =
		vtkShortArray::SafeDownCast ( f->GetPointData()->GetScalars() );

	  for (i=0; i<n; ++i)
		Image[i] =  array->GetValue(i);
	  findAortaInitializeParameters(dim[2]-1);
	  delete [] Image; Image = 0;
	*/
	/*
	  FILE * neck02body;
	  int label;
	  //neck02body = fopen("neck02bodylegs_segm_crashes_on_branch_reordering.txt","r");
	  neck02body = fopen("neck02bodylegs_segm.txt","r");
	  for (i=0; i<n; ++i)
	  {
		fscanf(neck02body,"%d",&label);

		if (label && i<=dim[0]*dim[1]*(dim[2]-2) && i>=dim[0]*dim[1]*2)
		  leftBranchMask[i] = 1;
		else
		  leftBranchMask[i] = 0;
	  }
	  fclose(neck02body);
	*/
	/*
	  printMaskOnTxt("aorta",leftBranchMask);

	  unsigned long long ind,len;
	  for (i=0; i<n; ++i)
		leftBranchMask[i]=0;
	  ifstream ifs;
	  ifs.open("../../VesselTreeBuilder/test/result/neckCase3-vesselnessCut.txt");
	  ifs >> len;
	  for (i=0; i<len; ++i)
	  {
		if (!(ifs >> ind))
		{
		  cout << "damaged file" << endl;
		  exit(0);
		}
		leftBranchMask[ind]=1;
	  }
	  ifs.close();

	  ifs.open("../../VesselTreeBuilder/test/result/neckCase3-aorta.txt");
	  ifs >> len;
	  for (i=0; i<len; ++i)
	  {
		if (!(ifs >> ind))
		{
		  cout << "damaged file" << endl;
		  exit(0);
		}
		leftBranchMask[ind]=1;
	  }
	  ifs.close();
	*/

	//  aorta_index = aortaCenterOnFirstSlice[0]
	//              + dim[0]*(dim[1]-aortaCenterOnFirstSlice[1]); //+ dim[1]*(dim[2]-1));
	aorta_index = 200 + dim[0] * (200 + dim[1] * (dim[2] - 1));

	char session[100] = "";
	char skeletonPath[100] = "../../VesselTreeBuilder/test/result/";
	strcat(session, parameters->sessionName);
	strcat(session, "_");
	strcat(skeletonPath, session);

	//thinner = new Thinner (leftBranchMask, dim, vsize);
	//thinner->ostia_ind = aorta_index;
	//thinner->maxNoiseLength = parameters->maxNoiseLength;
	//thinner->mainAlgorithm();

	//    cout << "Printing *.tre" <<endl;
	//thinner->printTre();
	//thinner->printReorderedTre(session);
//    cout << "Printing skeleton" << endl;
	thinner->printSkeletonOnTxt(skeletonPath);
}


//OLD VERSION
void VTB::printMaskOnTxt(char* maskType, bool* mask) {
	char path[1024] = "../../VesselTreeBuilder/test/result/";
	strcat(path, parameters->sessionName);
	strcat(path, "-");
	strcat(path, maskType);
	strcat(path, ".txt");
	unsigned long long i;
	FILE* fin;
	fin = fopen(path, "w");
	if (!fin) {
		cout << "Cannot open file to write mask: " << path << endl;
		return;
	}
	unsigned long long num_of_nodes = 0;
	for (i = 0; i < n; ++i)
		if (mask[i])
			num_of_nodes++;
	fprintf(fin, "%lld \n", num_of_nodes);
	for (i = 0; i < n; ++i)
		if (mask[i])
			fprintf(fin, "%lld \n", i);
	fclose(fin);
}


void VTB::initializeVTBParameters() {
	/*
  if (parameters) { delete[] parameters; parameters = 0; }
  parameters = new VTBParameters;
  ifstream ifs;
  ifs.open("../vtbparameters.txt");
  if (!(ifs >> parameters->sessionName))
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->dirName) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->idtStopParameter) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->aortaThreshold) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->frangiThreshold) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->minDistBetweenOstia) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->maxNoiseLength) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  if ( !(ifs >> parameters->minNumOfVoxelsInBranch) )
  {
	cout << "Wrong VTB parameters!" << endl;
	exit(0);
  }
  ifs.close();
  */
}


void VTB::getDistanceMap(bool* _mask, unsigned* distanceMap, bool rule) {
	long long i, temp;
	for (i = 0; i < n; ++i)
		distanceMap[i] = 0;
	//#pragma omp parallel for shared(_mask, distanceMap) private(temp)
	for (i = 0; i < n; ++i) {

		if (((!rule) ? _mask[i] : !(_mask[i]))) {
			temp = dim[0] + dim[1] + dim[2];
			if (!(i % dim[0] == 0))
				if (temp > 1 + distanceMap[i - 1])
					temp = 1 + distanceMap[i - 1];
			if (!((i / dim[0]) % dim[1] == 0))
				if (temp > 1 + distanceMap[i - dim[0]])
					temp = 1 + distanceMap[i - dim[0]];
			if (!(i < dim[0] * dim[1]))
				if (temp > 1 + distanceMap[i - dim[0] * dim[1]])
					temp = 1 + distanceMap[i - dim[0] * dim[1]];
			distanceMap[i] = temp;
		} else {
			distanceMap[i] = 0;
		}
	}

	//#pragma omp parallel for shared(distanceMap) private(temp)
	for (i = n - 2; i >= 0; --i) {
		temp = distanceMap[i];
		if (!temp) {
			if (0 == i)
				break;
			else
				continue;
		}
		if (!(i % dim[0] == dim[0] - 1)) {
			if (temp > 1 + distanceMap[i + 1])
				temp = 1 + distanceMap[i + 1];
		}
		if (!((i / dim[0]) % dim[1] == dim[1] - 1)) {
			if (temp > 1 + distanceMap[i + dim[0]])
				temp = 1 + distanceMap[i + dim[0]];
		}
		if (!(i / (dim[0] * dim[1]) == dim[2] - 1)) {
			if (temp > 1 + distanceMap[i + dim[0] * dim[1]])
				temp = 1 + distanceMap[i + dim[0] * dim[1]];
		}
		distanceMap[i] = temp;
		if (0 == i)
			break;
	}
}

void VTB::getDistanceMap(short* _mask, unsigned* distanceMap, bool rule) {
	unsigned long long i, temp;
	for (i = 0; i < n; ++i)
		distanceMap[i] = 0;

	for (i = 0; i < n; ++i) {
		if (((!rule) ? _mask[i] != 0 : _mask[i] == 0)) {
			temp = dim[0] + dim[1] + dim[2];
			if (!(i % dim[0] == 0))
				if (temp > 1 + distanceMap[i - 1])
					temp = 1 + distanceMap[i - 1];
			if (!((i / dim[0]) % dim[1] == 0))
				if (temp > 1 + distanceMap[i - dim[0]])
					temp = 1 + distanceMap[i - dim[0]];
			if (!(i < dim[0] * dim[1]))
				if (temp > 1 + distanceMap[i - dim[0] * dim[1]])
					temp = 1 + distanceMap[i - dim[0] * dim[1]];
			distanceMap[i] = temp;
		} else {
			distanceMap[i] = 0;
		}
	}

	for (i = n - 2; i >= 0; --i) {
		temp = distanceMap[i];
		if (!temp) {
			if (0 == i)
				break;
			else
				continue;
		}
		if (!(i % dim[0] == dim[0] - 1)) {
			if (temp > 1 + distanceMap[i + 1])
				temp = 1 + distanceMap[i + 1];
		}
		if (!((i / dim[0]) % dim[1] == dim[1] - 1)) {
			if (temp > 1 + distanceMap[i + dim[0]])
				temp = 1 + distanceMap[i + dim[0]];
		}
		if (!(i / (dim[0] * dim[1]) == dim[2] - 1)) {
			if (temp > 1 + distanceMap[i + dim[0] * dim[1]])
				temp = 1 + distanceMap[i + dim[0] * dim[1]];
		}
		distanceMap[i] = temp;
		if (0 == i)
			break;
	}
}

void VTB::smoothMask(unsigned sizeShrink, unsigned sizeExpand, bool* mask) {
	unsigned long long i;
	unsigned* distanceMap;
	try {
		distanceMap = new unsigned[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.distanceMap");
	}
	getDistanceMap(mask, distanceMap, 0);
	for (i = 0; i < n; ++i)
		if (distanceMap[i] < sizeShrink)
			mask[i] = 0;
	getDistanceMap(mask, distanceMap, 1);
	for (i = 0; i < n; ++i)
		if (distanceMap[i] < sizeExpand)
			mask[i] = 1;
	delete[] distanceMap;
}

void VTB::smoothMask(unsigned sizeShrink, unsigned sizeExpand, short* mask) {
	unsigned long long i;
	unsigned* distanceMap;
	try {
		distanceMap = new unsigned[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.distanceMap");
	}
	getDistanceMap(mask, distanceMap, 0);
	for (i = 0; i < n; ++i)
		if (distanceMap[i] < sizeShrink)
			mask[i] = 0;
	getDistanceMap(mask, distanceMap, 1);
	for (i = 0; i < n; ++i)
		if (distanceMap[i] < sizeExpand)
			mask[i] = 1;
	delete[] distanceMap;
}


void VTB::regionGrowing2(unsigned short* mask,
						  unsigned long long seed,
						  unsigned rule_value,
						  unsigned val,
						  bool only_result_matter) {
	unsigned long long i;
	unsigned long long nbr;
	unsigned long long num_of_nodes = 0;

	set<unsigned long long> front;
	unsigned short* temp_mask;
	try {
		temp_mask = new unsigned short[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.tmp_mask");
	}
	for (i = 0; i < n; ++i)
		temp_mask[i] = val + 1;

	front.insert(seed);
	temp_mask[seed] = val;
	++num_of_nodes;

	while (!front.empty()) {
		unsigned long long coord = *front.begin();
		front.erase(front.begin());

		if (!(coord < dim[0] * dim[1])) {
			nbr = coord - dim[0] * dim[1];
			if (mask[nbr] == rule_value && temp_mask[nbr] == val + 1) {
				temp_mask[nbr] = val;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == 0)) {
			nbr = coord - dim[0];
			if (mask[nbr] == rule_value && temp_mask[nbr] == val + 1) {
				temp_mask[nbr] = val;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == 0)) {
			nbr = coord - 1;
			if (mask[nbr] == rule_value && temp_mask[nbr] == val + 1) {
				temp_mask[nbr] = val;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == dim[0] - 1)) {
			nbr = coord + 1;
			if (mask[nbr] == rule_value && temp_mask[nbr] == val + 1) {
				temp_mask[nbr] = val;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) {
			nbr = coord + dim[0];
			if (mask[nbr] == rule_value && temp_mask[nbr] == val + 1) {
				temp_mask[nbr] = val;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1))) {
			nbr = coord + dim[0] * dim[1];
			if (mask[nbr] == rule_value && temp_mask[nbr] == val + 1) {
				temp_mask[nbr] = val;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
	}
	//  cout << "Num of nodes in region growing = " << num_of_nodes << endl;
	if (only_result_matter) {
		for (i = 0; i < n; ++i) {
			if (temp_mask[i] == val + 1)
				mask[i] = 0;
			else
				mask[i] = temp_mask[i];
		}
	} else
		for (i = 0; i < n; ++i)
			if (temp_mask[i] == val)
				mask[i] = val;
	delete[] temp_mask;

}


void VTB::WriteBorderOnTxt(unsigned short* map, char* name) {
	unsigned long long i, j, border_len = 0;

	for (j = 0; j < n; ++j) {
		if (map[j] == 0) continue;

		if (!(j < dim[0] * dim[1])) {
			if (map[j - dim[0] * dim[1]] == 0) {
				map[j] = 2;
				++border_len;
				continue;
			}
		}
		if (!((j / dim[0]) % dim[1] == 0)) {
			if (map[j - dim[0]] == 0) {
				map[j] = 2;
				++border_len;
				continue;
			}
		}
		if (!(j % dim[0] == 0)) {
			if (map[j - 1] == 0) {
				map[j] = 2;
				++border_len;
				continue;
			}
		}
		if (!(j % dim[0] == dim[0] - 1)) {
			if (map[j + 1] == 0) {
				map[j] = 2;
				++border_len;
				continue;
			}
		}
		if (!((j / dim[0]) % dim[1] == dim[0] - 1)) {
			if (map[j + dim[0]] == 0) {
				map[j] = 2;
				++border_len;
				continue;
			}
		}
		if (!(j >= dim[0] * dim[1] * (dim[2] - 1))) {
			if (map[j + dim[0] * dim[1]] == 0) {
				map[j] = 2;
				++border_len;
				continue;
			}
		}
	}

	//  cout << "Border Len = " << border_len << endl;
	FILE* fout;
	fout = fopen(name, "w");

	fprintf(fout, "%lld\n", border_len);
	for (i = 0; i < n; ++i)
		if (map[i] == 2) {
			fprintf(fout, "%lld ", i % dim[0]);
			fprintf(fout, "%lld ", (i / dim[0]) % dim[1]);
			fprintf(fout, "%lld \n", i / (dim[0] * dim[1]));
		}
	fclose(fout);
}


void VTB::initializeImageWithPulmonaryRemoval(short* data,
											 unsigned long long in_dim0,
											 unsigned long long in_dim1,
											 unsigned long long in_dim2,
											 float scaleX,
											 float scaleY,
											 float scaleZ,
											 unsigned long long aorta_index) {
	int intensity;
	//unsigned long long i;
	int i;
	bool* mask;

	aortaInitialPointIndex = aorta_index;
	dim[0] = in_dim0;
	dim[1] = in_dim1;
	dim[2] = in_dim2;

	vsize[0] = scaleX;
	vsize[1] = scaleY;
	vsize[2] = scaleZ;

	n = dim[0] * dim[1] * dim[2];
	try {
		Image = new short[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.Image");
	}

	try {
		mask = new bool[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.mask");
	}

	//#pragma omp parallel for shared(data,mask) private(intensity)
	for (i = 0; i < n; ++i) {
		intensity = data[i];
		if (intensity < -224)
			mask[i] = 0;
		else
			mask[i] = 1;
	}

	smoothMask(floor(.5 + 5. / vsize[0]), floor(.5 + 5. / vsize[0]), mask);

	//#pragma omp parallel for shared(mask,data) private(intensity)
	for (i = 0; i < n; ++i) {
		if (mask[i]) {
			intensity = data[i];
			if (intensity < 676)
				Image[i] = intensity;
			else
				Image[i] = 676;
		} else
			Image[i] = -224;
	}
	delete[] mask;




	double imageToSpace[16] = { 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 };
	double spaceToImage[16] = { 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1 };

	Image3D = new Utils::AGBImage3D(Image, dim, vsize, origin, imageToSpace, spaceToImage);

#ifdef MASK_FOR_VESSELNESS
	ofstream out;
	out.open("log_timeInitializeNonvesselnessMask.txt");

	auto begClock = clock();

	initializeNonvesselnessMask(160, 2);
	auto endTime = clock();
	out << "time = " << (double)(endTime - begClock) / CLOCKS_PER_SEC << " sec" << std::endl;
	out.close();
#endif //MASK_FOR_VESSELNESS
}


void VTB::removeIslands(short* labels, unsigned long long comp_threshold) {
	set<unsigned long long> front;
	vector<unsigned long long> comp;
	vector<unsigned long long>::iterator it;
	unsigned long long n = dim[0] * dim[1] * dim[2];
	unsigned long long i, coord, nbr, comp_ind, num_of_nodes;
	if (!Vesselness)
		return;
	for (i = 0; i < n; ++i)
		labels[i] = 0;
	comp_ind = 1;
	for (i = 0; i < n; ++i)
		if (Vesselness[i] > parameters->frangiThreshold && !labels[i]) {
			// for every unpassed foreground voxel find its connectivity
			// component
			front.clear();
			comp.clear();
			num_of_nodes = 0;
			front.insert(i);
			labels[i] = comp_ind;
			++num_of_nodes;

			while (!front.empty()) {
				coord = *front.begin();
				comp.push_back(coord);
				front.erase(front.begin());

				if (!(coord < dim[0] * dim[1])) {
					nbr = coord - dim[0] * dim[1];
					if (parameters->frangiThreshold < Vesselness[nbr] && !labels[nbr]) {
						labels[nbr] = comp_ind;
						front.insert(nbr);
						++num_of_nodes;
					}
				}
				if (!((coord / dim[0]) % dim[1] == 0)) {
					nbr = coord - dim[0];
					if (parameters->frangiThreshold < Vesselness[nbr] && !labels[nbr]) {
						labels[nbr] = comp_ind;
						front.insert(nbr);
						++num_of_nodes;
					}
				}
				if (!(coord % dim[0] == 0)) {
					nbr = coord - 1;
					if (parameters->frangiThreshold < Vesselness[nbr] && !labels[nbr]) {
						labels[nbr] = comp_ind;
						front.insert(nbr);
						++num_of_nodes;
					}
				}
				if (!(coord % dim[0] == dim[0] - 1)) {
					nbr = coord + 1;
					if (parameters->frangiThreshold < Vesselness[nbr] && !labels[nbr]) {
						labels[nbr] = comp_ind;
						front.insert(nbr);
						++num_of_nodes;
					}
				}
				if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) {
					nbr = coord + dim[0];
					if (parameters->frangiThreshold < Vesselness[nbr] && !labels[nbr]) {
						labels[nbr] = comp_ind;
						front.insert(nbr);
						++num_of_nodes;
					}
				}
				if (!(coord >= dim[0] * dim[1] * (dim[2] - 1))) {
					nbr = coord + dim[0] * dim[1];
					if (parameters->frangiThreshold < Vesselness[nbr] && !labels[nbr]) {
						labels[nbr] = comp_ind;
						front.insert(nbr);
						++num_of_nodes;
					}
				}
			}
			// if component is small set its label = -1
			// else set next label
			if (num_of_nodes < comp_threshold) {
				for (it = comp.begin(); it != comp.end(); it++)
					labels[*it] = -1;
			} else
				++comp_ind;
			comp.clear();
		}
	for (i = 0; i < n; ++i)
		if (labels[i] < 0)
			labels[i] = 0;
}


int VTB::regionGrowingInImage(const unsigned long long seed, bool* mask, int thold) {
	unsigned long long i;
	unsigned long long nbr;
	unsigned long long num_of_nodes = 0;

	set<unsigned long long> front;
	bool* temp_mask;
	try {
		temp_mask = new bool[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.temp_mask");
	}
	for (i = 0; i < n; ++i)
		temp_mask[i] = 0;

	front.insert(seed);
	temp_mask[seed] = 1;
	++num_of_nodes;

	while (!front.empty()) {
		unsigned long long coord = *front.begin();
		front.erase(front.begin());

		if (!(coord < dim[0] * dim[1])) {
			nbr = coord - dim[0] * dim[1];
			if (thold <= Image[nbr] && temp_mask[nbr] == 0) {
				temp_mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == 0)) {
			nbr = coord - dim[0];
			if (thold <= Image[nbr] && temp_mask[nbr] == 0) {
				temp_mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == 0)) {
			nbr = coord - 1;
			if (thold <= Image[nbr] && temp_mask[nbr] == 0) {
				temp_mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == dim[0] - 1)) {
			nbr = coord + 1;
			if (thold <= Image[nbr] && temp_mask[nbr] == 0) {
				temp_mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) {
			nbr = coord + dim[0];
			if (thold <= Image[nbr] && temp_mask[nbr] == 0) {
				temp_mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1))) {
			nbr = coord + dim[0] * dim[1];
			if (thold <= Image[nbr] && temp_mask[nbr] == 0) {
				temp_mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
	}

	for (i = 0; i < n; ++i)
		if (temp_mask[i])
			mask[i] = 1;

	delete[] temp_mask;

	return 0;
}


//REWRITTEN
//TODO CHECK!
int VTB::regionGrowing(const unsigned long long seed, int marker) {
	// region growing inside of vesselComponents
	// marks region with input marker
	// marker = 1 for left branch
	// marker = 2 for right branch
	unsigned long long i;
	double thold = parameters->frangiThreshold;
	unsigned long long nbr;
	unsigned long long num_of_nodes = 0;

	set<unsigned long long> front;
	for (i = 0; i < n; ++i)
		if (vesselComponents[i] == marker)
			vesselComponents[i] = 0;
	front.insert(seed);
	vesselComponents[seed] = marker;
	++num_of_nodes;

	while (!front.empty()) {
		unsigned long long coord = *front.begin();
		front.erase(front.begin());

		if (!(coord < dim[0] * dim[1])) {
			nbr = coord - dim[0] * dim[1];
			if (thold <= Vesselness[nbr] && vesselComponents[nbr] == 0) {
				vesselComponents[nbr] = marker; front.insert(nbr); ++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == 0)) {
			nbr = coord - dim[0];
			if (thold <= Vesselness[nbr] && vesselComponents[nbr] == 0) {
				vesselComponents[nbr] = marker; front.insert(nbr); ++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == 0)) {
			nbr = coord - 1;
			if (thold <= Vesselness[nbr] && vesselComponents[nbr] == 0) {
				vesselComponents[nbr] = marker; front.insert(nbr); ++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == dim[0] - 1)) {
			nbr = coord + 1;
			if (thold <= Vesselness[nbr] && vesselComponents[nbr] == 0) {
				vesselComponents[nbr] = marker; front.insert(nbr); ++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) {
			nbr = coord + dim[0];
			if (thold <= Vesselness[nbr] && vesselComponents[nbr] == 0) {
				vesselComponents[nbr] = marker; front.insert(nbr); ++num_of_nodes;
			}
		}
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1))) {
			nbr = coord + dim[0] * dim[1];
			if (thold <= Vesselness[nbr] && vesselComponents[nbr] == 0) {
				vesselComponents[nbr] = marker; front.insert(nbr); ++num_of_nodes;
			}
		}
	}
	if (num_of_nodes < parameters->minNumOfVoxelsInBranch) {
		for (i = 0; i < n; ++i)
			if (vesselComponents[i] == marker)
				Vesselness[i] *= -1.;
		return 1;
	}
	return 0;
}


int VTB::regionGrowing(const unsigned long long seed, bool* mask) {
	unsigned long long i;
	double thold = parameters->frangiThreshold;
	unsigned long long nbr;
	unsigned long long num_of_nodes = 0;

	set<unsigned long long> front;
	for (i = 0; i < n; ++i)
		mask[i] = 0;
	front.insert(seed);
	mask[seed] = 1;
	++num_of_nodes;

	while (!front.empty()) {
		unsigned long long coord = *front.begin();
		front.erase(front.begin());

		if (!(coord < dim[0] * dim[1])) {
			nbr = coord - dim[0] * dim[1];
			if (thold <= Vesselness[nbr] && mask[nbr] == 0) {
				mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == 0)) {
			nbr = coord - dim[0];
			if (thold <= Vesselness[nbr] && mask[nbr] == 0) {
				mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == 0)) {
			nbr = coord - 1;
			if (thold <= Vesselness[nbr] && mask[nbr] == 0) {
				mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord % dim[0] == dim[0] - 1)) {
			nbr = coord + 1;
			if (thold <= Vesselness[nbr] && mask[nbr] == 0) {
				mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) {
			nbr = coord + dim[0];
			if (thold <= Vesselness[nbr] && mask[nbr] == 0) {
				mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1))) {
			nbr = coord + dim[0] * dim[1];
			if (thold <= Vesselness[nbr] && mask[nbr] == 0) {
				mask[nbr] = 1;
				front.insert(nbr);
				++num_of_nodes;
			}
		}
	}
	if (num_of_nodes < parameters->minNumOfVoxelsInBranch) {
		for (i = 0; i < n; ++i)
			if (mask[i]) {
				Vesselness[i] *= -1.;
				//mask[i]=0;
			}
		return 1;
	}

	//  if (mask)
	//    for (i=0; i<n; ++i)
	//      if (temp_mask[i])
	//        mask[i] = 1;

	//  delete[] temp_mask;

	return 0;
}


void VTB::preprocessAorta() {
	unsigned long long i;
	if (idt != nullptr) { delete idt; idt = 0; }
	idt = new IDT(Image,
		parameters->aortaThreshold,
		parameters->idtStopParameter,
		aortaInitialPointIndex,
		dim,
		vsize,
		aortaInitialPointIndex);
	if (aortaMask == nullptr) {
		try {
			aortaMask = new bool[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.aortaMask");
		}
	}
	for (i = 0; i < n; ++i)
		aortaMask[i] = idt->resulting_mask[i];
}


unsigned long long VTB::getIndex(unsigned x, unsigned y, unsigned z) {
	return (unsigned long long)x + dim[0] *
		((unsigned long long)y + dim[1] *
		(unsigned long long)z);
}


//REWRITTEN!
//TODO: CHECK!
void VTB::preprocessCoronaryArteries() {
	//findOstiaPointsViaLeaks();
	// comment when segmentation is manual
#ifndef MANUAL_SEGMENTATION 
	findOstiaPoints();
#endif
	//smyrov: это под комментом, потому что в левой ветви сосуды практически сразу расходятся
	for (auto i = 0; i < n; ++i)
		if (aortaMask[i]) {
			if (vesselComponents)
				vesselComponents[i] = 0;
		}

	if (leftOstia > -1 || rightOstia > -1) {
		unsigned* dmap;
		try {
			dmap = new unsigned[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.dmap");
		}
		removeNearAortaVesselLeaks(dmap, unsigned(floor(.5 + 3. / vsize[0])));
		//Smyrov:
		//removeNearAortaVesselLeaks(dmap, unsigned(floor(.5 + 10./vsize[0])));
		delete[] dmap;
	}
	for (auto i = 0; i < userMarkedVessels.size(); ++i) {
		auto iv = userMarkedVessels[i];
		for (auto it = iv.begin(); it != iv.end(); it++) {
			if (vesselComponents[*it] < 3) vesselComponents[*it] = 3 + i;
		}
	}
}


void VTB::preprocessVesselness() {
#ifdef PRINT_AORTA_SURFACE
	Utils::writeMaskOnSTL(aortaMask, dim, vsize, origin, "aorta_surface");
#endif // PRINT_AORTA_SURFACE

    FFRService_update_progres(0.05f, L"Coronary arteries segmentation");
	unsigned long long i;
	idt->removeVessels(unsigned(floor(0.5 + 5. / vsize[0])));
    FFRService_update_progres(0.09f, L"Coronary arteries segmentation");

	//Smyrov
	//idt->removeVessels(unsigned(floor(0.5+10./vsize[0])));
	for (i = 0; i < n; ++i) {
#ifdef CUT_DECSENDING_AORTA
		if (i / dim[0] % dim[1] > 300)
			idt->resulting_mask[i] = 0;
#endif
		aortaMask[i] = idt->resulting_mask[i];
	}

	// leave only one connectivity component
	bool* mask_ptr = idt->resulting_mask;
	set<unsigned long long> front;
	for (i = 0; i < n; ++i)
		aortaMask[i] = 0;
	front.insert(aortaInitialPointIndex);
	aortaMask[aortaInitialPointIndex] = 1;

    FFRService_update_progres(0.12f, L"Coronary arteries segmentation");

	while (!front.empty()) {
		unsigned long long coord = *front.begin();
		front.erase(front.begin());

		if (!(coord < dim[0] * dim[1])) {
			auto nbr = coord - dim[0] * dim[1];
			if (mask_ptr[nbr] && !aortaMask[nbr]) { aortaMask[nbr] = 1; front.insert(nbr); }
		}
		if (!((coord / dim[0]) % dim[1] == 0)) {
			auto nbr = coord - dim[0];
			if (mask_ptr[nbr] && !aortaMask[nbr]) { aortaMask[nbr] = 1; front.insert(nbr); }
		}
		if (!(coord % dim[0] == 0)) {
			auto nbr = coord - 1;
			if (mask_ptr[nbr] && !aortaMask[nbr]) { aortaMask[nbr] = 1; front.insert(nbr); }
		}
		if (!(coord % dim[0] == dim[0] - 1)) {
			auto nbr = coord + 1;
			if (mask_ptr[nbr] && !aortaMask[nbr]) { aortaMask[nbr] = 1; front.insert(nbr); }
		}
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1)) {
			auto nbr = coord + dim[0];
			if (mask_ptr[nbr] && !aortaMask[nbr]) { aortaMask[nbr] = 1; front.insert(nbr); }
		}
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1))) {
			auto nbr = coord + dim[0] * dim[1];
			if (mask_ptr[nbr] && !aortaMask[nbr]) { aortaMask[nbr] = 1; front.insert(nbr); }
		}
	}
	mask_ptr = nullptr;



#ifdef PRINT_AORTA_VTB
	ofstream o;
	o.open("aorta.vtk");
	o << "# vtk DataFile Version 3.0\n" <<
		"vtk output\n" <<
		"ASCII\n" <<
		"DATASET RECTILINEAR_GRID\n" << "DIMENSIONS "
		<< dim[0] + 1 << " " << dim[1] + 1 << " " << dim[2] + 1 << endl;

	o << "X_COORDINATES " << dim[0] + 1 << " float\n";
	for (int i = 0; i <= dim[0]; i++)
		o << vsize[0] * i << "\n";
	o << "Y_COORDINATES " << dim[1] + 1 << " float\n";
	for (int i = 0; i <= dim[1]; i++)
		o << vsize[1] * i << "\n";
	o << "Z_COORDINATES " << dim[2] + 1 << " float\n";
	for (int i = 0; i <= dim[2]; i++)
		o << vsize[2] * i << "\n";
	o << "CELL_DATA " << n << endl;
	o << "SCALARS cell_sca1lars int 1\nLOOKUP_TABLE default\n";

	int* tmp;
	try {
		tmp = new int[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad alloc VTB.tmp");
	}
	for (size_t i = 0; i < n; i++)
		tmp[i] = -2048;
	for (size_t i = 0; i < idt->num_of_nodes; i++)
		tmp[idt->Nodes[idt->solutionOrder[i]]] = i;

	for (size_t i = 0; i < n; i++) {
		o << tmp[i] << endl;
	}
	delete[] tmp;
	o << "POINT_DATA " << (dim[0] + 1) * (dim[1] + 1) * (dim[2] + 1) << endl;
	o.close();
	exit(0);
#endif

#ifdef PRINT_AORTA_SURFACE
	Utils::writeMaskOnSTL(aortaMask, dim, vsize, origin, "aorta_surface_smoothed");
	//exit(0);
#endif
    FFRService_update_progres(0.15f, L"Coronary arteries segmentation");

#ifdef PRINT_AORTA
	ofstream o;
	o.open("aorta.raw");
	o << dim[0] << " " << dim[1] << " " << dim[2] << endl;

	for (size_t i = 0; i < n; i++)
		o << aortaMask[i];
	o.close();

	ofstream h;
	h.open("aorta.mhd");
	h << "ObjectType = Image\n";
	h << "NDims = 3\n";
	//h << "TransformMatrix = " << transformMatrix[0] << " " << transformMatrix[1] << " " << transformMatrix[2] << " "
	//  << transformMatrix[3] << " " << transformMatrix[4] << " " << transformMatrix[5] << " "
	//  << transformMatrix[6] << " " << transformMatrix[7] << " " << transformMatrix[8] << "\n";
	h << "Offset = " << origin[0] << " " << origin[1] << " " << origin[2] << "\n";
	// TODO ????
	//  AnatomicalOrientation = RAI

	h << "DimSize = " << dim[0] << " " << dim[1] << " " << dim[2] << "\n";
	h << "ElementType = MET_UCHAR\n";
	h << "ElementSpacing = " << vsize[0] << " " << vsize[1] << " " << vsize[2] << "\n";
	h << "ElementDataFile = aorta.raw\n";
	exit(0);
#endif
	// comment if segmentation is manual
#ifndef MANUAL_SEGMENTATION

	if (Vesselness == nullptr) {
		try {
			Vesselness = new double[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.Vesselness");
		}
	}
	double sigmas[3] = { 1,3,1 };
#ifndef MASK_FOR_VESSELNESS
	FrangiFilter3d(Vesselness,
		1,
		Image, dim, sigmas,
		parameters->frangi_alpha,
		parameters->frangi_beta,
		parameters->frangi_c,
		0);
#else // !MASK_FOR_VESSELNESS

    FFRService_update_progres(0.17f, L"Coronary arteries segmentation");

	// masking vesselness
	short* ImageMaskedForVesselness;
	try {
		ImageMaskedForVesselness = new short[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.vesselComponents");
	}
#ifdef NONVESSELNESS_FROM_FILE
	ifstream manMask;
	//manMask.open("maskedValves_Vasin.txt");
	//manMask.open("maskedValves_Shurmin.txt");
	manMask.open("nonvesselness_Djalanyan.txt");
	size_t numOfMaskedVoxels;
	manMask >> numOfMaskedVoxels;
	for (size_t i = 0; i < n; i++)
		nonvesselnessMask[i] += 0;
	for (size_t i = 0; i < numOfMaskedVoxels; i++) {
		unsigned long long index;
		manMask >> index;
		nonvesselnessMask[getIndex(index % dim[0], index / dim[0] % dim[1], dim[2] - 1 - index / (dim[0] * dim[1]))] = 255;
	}
	manMask.close();
#endif //NONVESSELNESS_FROM_FILE
	for (int i = 0; i < n; i++)
		ImageMaskedForVesselness[i] = (short)floor((1.0 - (double)nonvesselnessMask[i] / 255) * Image[i]);

    FFRService_update_progres(0.2f, L"Coronary arteries segmentation");

    FrangiFilter3d(Vesselness,
		1,
		ImageMaskedForVesselness, dim, sigmas,
		parameters->frangi_alpha,
		parameters->frangi_beta,
		parameters->frangi_c,
		0);
	delete[] ImageMaskedForVesselness;

    FFRService_update_progres(0.96f, L"Coronary arteries segmentation");

#endif // MASK_FOR_VESSELNESS

	double rescaler = 1;
	double maxFilterValue = 0;
	for (unsigned long long i = 0; i < n; ++i)
		if (Vesselness[i] > maxFilterValue)
			maxFilterValue = Vesselness[i];
	if (maxFilterValue > 1e-8) {
		rescaler = 1024. / maxFilterValue;
		for (unsigned long long i = 0; i < n; ++i)
			Vesselness[i] *= rescaler;
	}
	// delete vesselness inside of aorta
	for (i = 0; i < n; ++i)
		if (aortaMask[i])
			Vesselness[i] = 0;
	// delete vesselness from slices with circles
	{
		unsigned long long az = aortaInitialPointIndex / dim[0] / dim[1];
		if (az < dim[2] / 2)
			for (unsigned long long i = 0; i < dim[0] * dim[1] * (az); i++)
				Vesselness[i] = 0;
		else
			for (unsigned long long i = dim[0] * dim[1] * (dim[2] - (dim[2] - az - 1) - 1); i < n; i++)
				Vesselness[i] = 0;
	}
#endif
    FFRService_update_progres(0.97f, L"Coronary arteries segmentation");

	// create nearAortaMask
	{
		unsigned* dmap;
		try {
			dmap = new unsigned[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.dmap");
		}

		getDistanceMap(aortaMask, dmap, 1);
		if (nearAortaMask == nullptr) {
			try {
				nearAortaMask = new bool[n];
			} catch (std::bad_alloc) {
                throw std::runtime_error("Cannot allocate memory for VTB.nearAortaMask");
			}
		}
		for (i = 0; i < n; ++i) {
			if (dmap[i] > 0 && dmap[i] < parameters->ostiumSearchThickness)
				nearAortaMask[i] = 1;
			else
				nearAortaMask[i] = 0;
		}
		delete[] dmap;
	}

    FFRService_update_progres(0.99f, L"Coronary arteries segmentation");

    return;
}


//OLD FUNCTION -> DELETED
void VTB::extractCoronaryVessels() {
}


bool VTB::findAortaInitializeParameters(unsigned long long sliceIndex) {
	// copy first few slices into itk format
	// to use itk circular Hought transform
	typedef itk::ImportImageFilter< short, 2 > ImportFilterType;
	ImportFilterType::Pointer importFilter = ImportFilterType::New();
	ImportFilterType::SizeType size;
	size[0] = dim[0]; size[1] = dim[1];
	ImportFilterType::IndexType start;
	start.Fill(0);
	ImportFilterType::RegionType region;
	region.SetIndex(start);
	region.SetSize(size);
	importFilter->SetRegion(region);

	const itk::SpacePrecisionType origin_slice[2] = { 0.0, 0.0 };
	importFilter->SetOrigin(origin_slice);
	const itk::SpacePrecisionType  spacing[2] = { 1.0, 1.0 };
	importFilter->SetSpacing(spacing);

	unsigned long long shift = dim[0] * dim[1];
	if (sliceIndex >= dim[2])
		shift *= (dim[2] - 1);
	else
		shift *= sliceIndex;
	short* slice = Image + shift;
	importFilter->SetImportPointer(slice, dim[0] * dim[1], false);

	//  cout << "Computing Hough Map" << endl;
	typedef itk::HoughTransform2DCirclesImageFilter<short,
		float, float> HoughTransformFilterType;
	HoughTransformFilterType::Pointer houghFilter
		= HoughTransformFilterType::New();
	houghFilter->SetInput(importFilter->GetOutput());
	houghFilter->SetNumberOfCircles(1);
	houghFilter->SetMinimumRadius(12. / vsize[0]);
	houghFilter->SetMaximumRadius(26. / vsize[0]);

	houghFilter->Update();

	HoughTransformFilterType::CirclesListType circles;
	/*circles = houghFilter->GetCircles(1);
	if ( circles.size() != 1 )
	{
	  cout << "Cannot find aorta center!" << endl;
	  return 1;
	}*/
	circles = houghFilter->GetCircles();
	double maxCircleRad = -1e+20;
	int maxCircleX = -1;
	int maxCircleY = -1;
	using ImageType = itk::Image<short, 2>;
	for (auto itCircles = circles.begin(); itCircles != circles.end(); itCircles++) {
		if (maxCircleRad < (*itCircles)->GetRadiusInObjectSpace()[0]) {
			maxCircleRad = (*itCircles)->GetRadiusInObjectSpace()[0];
			const HoughTransformFilterType::CircleType::PointType centerPoint = (*itCircles)->GetCenterInObjectSpace();
			maxCircleX = itk::Math::Round<ImageType::IndexType::IndexValueType>(centerPoint[0]);
			maxCircleY = itk::Math::Round<ImageType::IndexType::IndexValueType>(centerPoint[1]);
		}

	}
	if (maxCircleX == -1 || maxCircleY == -1) {
		//cout << "Cannot find aorta center!" << endl;
		return false;
	}

	/*
	aortaCenterOnFirstSlice[0] =
		 (*circles.begin())->GetObjectToParentTransform()->GetOffset()[0];
	aortaCenterOnFirstSlice[1] =
		 (*circles.begin())->GetObjectToParentTransform()->GetOffset()[1];
	aortaRadiusOnFirstSlice = (*circles.begin())->GetRadius()[0];
	*/

	aortaCenterOnFirstSlice[0] = maxCircleX;
	aortaCenterOnFirstSlice[1] = maxCircleY;
	aortaRadiusOnFirstSlice = maxCircleRad * vsize[0];


	/*
	short intensity;
	aortaMaskThresholdValue = 1000;
	for (unsigned yy=0; yy<dim[1]; ++yy)
	  for (unsigned xx=0; xx<dim[0]; ++xx)
	  {
		if ( sqrt(
			 (xx-aortaCenterOnFirstSlice[0])*(xx-aortaCenterOnFirstSlice[0]) +
			 (yy-aortaCenterOnFirstSlice[1])*(yy-aortaCenterOnFirstSlice[1]) )
			 < aortaRadiusOnFirstSlice/2 )
		{
		  intensity = Image[ xx + dim[0] * yy ];
		  if (intensity < aortaMaskThresholdValue)
			aortaMaskThresholdValue = intensity;
		}
	  }
	aortaMaskThresholdValue -= 70;
	*/
}


void VTB::findOstiaPointsViaLeaks() {
	unsigned long long i;
	unsigned dmap_threshold = 10;
	int intensity_threshold = 300;
	unsigned* dmap;
	try {
		dmap = new unsigned[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.dmap");
	}
	vector <unsigned long long> nearAortaLayer;

	// create nearAortaMask with voxels next 
	// to aorta border with inteisities > 300
	{
		getDistanceMap(aortaMask, dmap, 1);
		if (nearAortaMask != nullptr) { delete[] nearAortaMask; nearAortaMask = nullptr; }
		try {
			nearAortaMask = new bool[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.nearAortaMask");
		}
		for (i = 0; i < n; ++i) {
			if (dmap[i] == 1) {
				if (Image[i] > intensity_threshold) {
					nearAortaMask[i] = 1;
					nearAortaLayer.push_back(i);
				}
			} else
				nearAortaMask[i] = 0;
		}

	}
	// find connected components
	vector<vector<unsigned long long> > components;
	set<unsigned long long> front;
	vector<unsigned long long> comp;
	unsigned long long ind, nbr;

	bool* voxelPassed;
	try {
		voxelPassed = new bool[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Cannot allocate memory for VTB.voxelPassed");
	}

	for (i = 0; i < n; ++i)
		voxelPassed[i] = 0;

	for (auto it = nearAortaLayer.begin(); it != nearAortaLayer.end(); ++it) {
		i = *it;
		if (voxelPassed[i])
			continue;
		// for every unpassed foreground voxel find its connected component
		front.clear();
		comp.clear();
		front.insert(i);
		voxelPassed[i] = 1;
		while (!front.empty()) {
			ind = *front.begin();
			comp.push_back(ind);
			nearAortaMask[ind] = 1;
			front.erase(front.begin());

			if (!(ind < dim[0] * dim[1])) {
				nbr = ind - dim[0] * dim[1];
				if (Image[nbr] > intensity_threshold && !voxelPassed[nbr])
					if (dmap[nbr] > 0 && dmap[nbr] < dmap_threshold) {
						voxelPassed[nbr] = 1;
						front.insert(nbr);
					}
			}
			if (!((ind / dim[0]) % dim[1] == 0)) {
				nbr = ind - dim[0];
				if (Image[nbr] > intensity_threshold && !voxelPassed[nbr])
					if (dmap[nbr] > 0 && dmap[nbr] < dmap_threshold) {
						voxelPassed[nbr] = 1;
						front.insert(nbr);
					}
			}
			if (!(ind % dim[0] == 0)) {
				nbr = ind - 1;
				if (Image[nbr] > intensity_threshold && !voxelPassed[nbr])
					if (dmap[nbr] > 0 && dmap[nbr] < dmap_threshold) {
						voxelPassed[nbr] = 1;
						front.insert(nbr);
					}
			}
			if (!(ind % dim[0] == dim[0] - 1)) {
				nbr = ind + 1;
				if (Image[nbr] > intensity_threshold && !voxelPassed[nbr])
					if (dmap[nbr] > 0 && dmap[nbr] < dmap_threshold) {
						voxelPassed[nbr] = 1;
						front.insert(nbr);
					}
			}
			if (!((ind / dim[0]) % dim[1] == dim[1] - 1)) {
				nbr = ind + dim[0];
				if (Image[nbr] > intensity_threshold && !voxelPassed[nbr])
					if (dmap[nbr] > 0 && dmap[nbr] < dmap_threshold) {
						voxelPassed[nbr] = 1;
						front.insert(nbr);
					}
			}
			if (!(ind >= dim[0] * dim[1] * (dim[2] - 1))) {
				nbr = ind + dim[0] * dim[1];
				if (Image[nbr] > intensity_threshold && !voxelPassed[nbr])
					if (dmap[nbr] > 0 && dmap[nbr] < dmap_threshold) {
						voxelPassed[nbr] = 1;
						front.insert(nbr);
					}
			}
		}
		components.push_back(comp);
	}
	// remove all voxels outcoming from aorta border not far
	{
		removeNearAortaVesselLeaks(dmap, nearAortaMask, dmap_threshold / 2);
		for (auto it = components.begin(); it != components.end(); ) {
			bool to_delete = 1;
			for (auto it_comp = (*it).begin(); it_comp != (*it).end(); ++it_comp)
				if (nearAortaMask[(*it_comp)]) {
					to_delete = 0;
					break;
				}
			if (to_delete) {
				components.erase(it);
			} else {
				++it;
			}
		}
	}
	delete[] dmap;
	delete[] voxelPassed;

	//remove largest component that is left ventricle part
	// choose 2 components with maximal vesselness
	{
		unsigned j = 0;
		unsigned max_ind = 0;
		unsigned max_size = 0;
		set <pair<double, unsigned> > comp_set;
		double average_vesselness = 0;
		for (j = 0; j < components.size(); ++j) {
			if (max_size < components[j].size()) {
				max_size = components[j].size();
				max_ind = j;
			}
			average_vesselness = 0;
			for (auto it = components[j].begin(); it != components[j].end(); ++it)
				average_vesselness += Vesselness[*it];
			average_vesselness /= components[j].size();
			comp_set.insert(make_pair(average_vesselness, j));
		}
		components.erase(components.begin() + (max_ind - 1));
		unsigned long long comp_ind1, comp_ind2;
		auto it = comp_set.end()--;
		comp_ind1 = (*it).second;
		if (comp_ind1 == max_ind) {
			it--;
			comp_ind1 = (*it).second;
		}
		it--;

		comp_ind2 = (*it).second;
		if (comp_ind2 == max_ind) {
			it--;
			comp_ind2 = (*it).second;
		}
		ostia1 = components[comp_ind1][0];
		ostia2 = components[comp_ind2][0];
	}

}


//REWRITTEN!
//TODO CHECK!
void VTB::findOstiaPoints() {
	assert(nearAortaMask);
	assert(Vesselness);
	unsigned long long i;
	for (i = 0; i < n; ++i)
		if (Vesselness[i] < 0)
			Vesselness[i] *= -1.;

	if (vesselComponents == nullptr) {
		try {
			vesselComponents = new short[n];
		} catch (std::bad_alloc) {
            throw std::runtime_error("Cannot allocate memory for VTB.vesselComponents");
		}
	}
    memset(vesselComponents,0,n*sizeof(vesselComponents[0]));

#ifdef PRINT_LOG_VTB
	ofstream o; o.open("log_ostium.txt");
#endif
	// find first and second ostia points
	{
#ifdef PRINT_LOG_VTB
		o << "first ostium" << endl;
#endif
		// найти максимум сосудистости
		findFirstOstiaPoint();
		int count = 0;
		// берем компоненты связности, пока они не станут больше порога parameters->minNumOfVoxelsInBranch
		// если меньше, то умножаем Vesselness внутри этой компоненты на -1
		while (regionGrowing(ostia1, 1)) {
			// ищем новый максимум сосудистости
			findFirstOstiaPoint();
			count++;
			if (count > 50) {
				ostia1 = -1;
				return;
			}
		}
#ifdef PRINT_LOG_VTB
		unsigned long long a = 0;
		for (unsigned long long j = 0; j < n; j++)
			if (vesselComponents[j] == 1)
				a++;
		o << "num of points in left branch: " << a << endl;
		o << "left count =" << count << "\nSecond ostia\n";
#endif
		// reduce vesselness near the first ostium in the aorta border neighbourhood
		count = 0;
		for (i = 0; i < n; i++)
			if (nearAortaMask[i]) {
				int ostia_x = ostia1 % dim[0], i_x = i % dim[0];
				int ostia_y = ostia1 / dim[0] % dim[1], i_y = i / dim[0] % dim[1];
				int ostia_z = ostia1 / dim[0] / dim[1], i_z = i / dim[0] / dim[1];
				double distToFirstOstia = std::sqrt((double)((ostia_x - i_x) * (ostia_x - i_x)
															 + (ostia_y - i_y) * (ostia_y - i_y)
															 + (ostia_z - i_z) * (ostia_z - i_z)));
				if (distToFirstOstia < parameters->minDistBetweenOstia && Vesselness[i] >= 0.)
					Vesselness[i] *= -1;
			}
		findSecondOstiaPoint();

		if (ostia2 > -1) {
			while (regionGrowing(ostia2, 2)) {
				findSecondOstiaPoint();
				count++;
				if (count > 100) {
					ostia2 = -1;
					break;
				}
			}
		}
#ifdef PRINT_LOG_VTB
		a = 0;
		for (unsigned long long j = 0; j < n; j++)
			if (vesselComponents[j])
				a++;
		o << "num of points in right branch: " << a << endl;
		o << "count " << count << endl;
#endif
	}
	// find out which ostia is left and which is right
	{
		// copy first few slices into itk format
		// to use itk circular Hough transform

		typedef itk::ImportImageFilter< short, 2 > ImportFilterType;

		ImportFilterType::Pointer importFilter = ImportFilterType::New();
		ImportFilterType::SizeType size;
		//size[0] = dim[0]; size[1] = dim[1];
		size[0] = dim[0]; size[1] = min(aortaCenterOnFirstSlice[1] * 2, dim[1]);
		ImportFilterType::IndexType start;
		start.Fill(0);
		ImportFilterType::RegionType region;
		region.SetIndex(start);
		region.SetSize(size);
		importFilter->SetRegion(region);

		const itk::SpacePrecisionType origin_slice[2] = { 0.0, 0.0 };
		importFilter->SetOrigin(origin_slice);
		const itk::SpacePrecisionType  spacing[2] = { 1.0, 1.0 };
		importFilter->SetSpacing(spacing);

		// slice with first ostia point 
		short* slice = Image + dim[1] * dim[0] * (ostia1 / (dim[1] * dim[0]));
		importFilter->SetImportPointer(slice, size[0] * size[1], false);

		typedef itk::HoughTransform2DCirclesImageFilter<short,
			float, float> HoughTransformFilterType;
		HoughTransformFilterType::Pointer houghFilter
			= HoughTransformFilterType::New();
		houghFilter->SetInput(importFilter->GetOutput());
		houghFilter->SetNumberOfCircles(1);
		houghFilter->SetMinimumRadius(10. / vsize[0]);
		houghFilter->SetMaximumRadius(23. / vsize[0]);

		houghFilter->Update();
		HoughTransformFilterType::CirclesListType circles;
		circles = houghFilter->GetCircles();
		// choose circle that intersects with aorta not less than 80%

		int isCircleFound = 1;
		/*
			// Для поиска несокльких кругов
			int isCircleFound = 0;
			auto ic = circles.begin();

			while (ic!= circles.end())
			{
			  int ax = (*ic)->GetObjectToParentTransform()->GetOffset()[0];
			  int ay = (*ic)->GetObjectToParentTransform()->GetOffset()[1];
			  double ar = (*ic)->GetRadius()[0];
			  double inCircleCount=0;
			  double inAortaCount=0;
			  for (unsigned long long ind=0; ind < dim[0]*dim[1]; ind++)
				if ((ax - ind%dim[0])*(ax - ind%dim[0]) + (ay - ind/dim[0])*(ay - ind/dim[0]) < ar*ar){
				  inCircleCount += 1;
				  if (aortaMask[ind + dim[1]*dim[0]*(ostia1 / (dim[1]*dim[0]))])
					inAortaCount += 1;
				}
			  if (inAortaCount/inCircleCount > 0.8)
			  {
				isCircleFound=1;
				break;
			  }
			  ic++;
			}

			if (!isCircleFound) {
		*/

		if (circles.size() != 1) {
			isCircleFound = 0;
			if (ostia2 > 0) {
				slice = Image + dim[1] * dim[0] * (ostia2 / (dim[1] * dim[0]));
				importFilter->SetImportPointer(slice, dim[0] * dim[1], false);

				houghFilter->SetInput(importFilter->GetOutput());
				houghFilter->SetNumberOfCircles(1);
				houghFilter->SetMinimumRadius(10. / vsize[0]);
				houghFilter->SetMaximumRadius(23. / vsize[0]);

				houghFilter->Update();
				circles = houghFilter->GetCircles();

				isCircleFound = 2;
				if (circles.size() != 1) {
					isCircleFound = 0;
					leftOstia = ostia1;
					rightOstia = ostia2;
				}
			}
		}
		if (isCircleFound) {
			//o << "Circle is found!\n";
				  /*
				  int aorta_center_x =
					(*circles.begin())->GetObjectToParentTransform()->GetOffset()[0];
				  int aorta_center_y =
					(*circles.begin())->GetObjectToParentTransform()->GetOffset()[1];
				  */
			double maxCircleRad = -1e+20;
			int maxCircleX = -1;
			int maxCircleY = -1;
			using ImageType = itk::Image<short, 2>;
			for (auto itCircles = circles.begin(); itCircles != circles.end(); itCircles++) {
				if (maxCircleRad < (*itCircles)->GetRadiusInObjectSpace()[0]) {
					maxCircleRad = (*itCircles)->GetRadiusInObjectSpace()[0];
					const HoughTransformFilterType::CircleType::PointType centerPoint = (*itCircles)->GetCenterInObjectSpace();
					maxCircleX = itk::Math::Round<ImageType::IndexType::IndexValueType>(centerPoint[0]);
					maxCircleY = itk::Math::Round<ImageType::IndexType::IndexValueType>(centerPoint[1]);
				}

			}
			int aorta_center_x = maxCircleX;
			int aorta_center_y = maxCircleY;

			int ostiaOnCircleSlice_x, ostiaOnCircleSlice_y;
			if (isCircleFound == 1) {
				ostiaOnCircleSlice_x = ostia1 % dim[0];
				ostiaOnCircleSlice_y = (ostia1 / dim[0]) % dim[1];
			} else if (isCircleFound == 2) {
				ostiaOnCircleSlice_x = ostia2 % dim[0];
				ostiaOnCircleSlice_y = (ostia2 / dim[0]) % dim[1];
			}
			float x, y, R;
			x = (float)ostiaOnCircleSlice_x - aorta_center_x;
			y = (float)ostiaOnCircleSlice_y - aorta_center_y;
			R = sqrt(x * x + y * y);
			x /= R; y /= R;


			double mean_HU = 0;
			int counter = 0;
			for (auto ii = 0; ii < 512; ii++)
				for (auto jj = 0; jj < 512; jj++) {
					/*if (sqrt((aorta_center_x - ii) * (aorta_center_x - ii) +
						  ((aorta_center_y - jj)) * ((aorta_center_y - jj))) < (*circles.begin())->GetRadius()[0] / 2.0) {
					*/
					if (sqrt((aorta_center_x - ii) * (aorta_center_x - ii) +
						((aorta_center_y - jj)) * ((aorta_center_y - jj))) < maxCircleRad * vsize[0] / 2.0) {
						mean_HU += Image[getIndex(ii, jj, (isCircleFound == 1 ? ostia1 / (dim[0] * dim[1]) : ostia2 / (dim[0] * dim[1])))];
						counter++;
					}
				}
			mean_HU /= counter;
			ofstream s;
			s.open("slice.txt");
			for (auto ii = 0; ii < 512; ii++)
				for (auto jj = 0; jj < 512; jj++) {
					s << Image[getIndex(ii, jj, (isCircleFound == 1 ? ostia1 / (dim[0] * dim[1]) : ostia2 / (dim[0] * dim[1])))] << " ";
				}
			s.close();
			// orientation is accounted in the next condition
#ifdef PRINT_LOG_VTB
			ofstream o;
			o.open("log_circle-vtb.txt");
			o << "Circle is found = " << isCircleFound << endl;
			o << "reversed x = " << reversedX << ", reversed y = " << reversedY << endl;
			o << "x = " << x << ", y = " << y << endl;
			o << "ostia point = [" << ostiaOnCircleSlice_x << ", " << ostiaOnCircleSlice_y << "]" << endl;
			o << "ostia1 = [" << ostia1 % dim[0] << ", " << ostia1 / dim[0] % dim[1] << ", " << ostia1 / (dim[1] * dim[0]) << "]" << endl;
			o << "ostia2 = [" << ostia2 % dim[0] << ", " << ostia2 / dim[0] % dim[1] << ", " << ostia2 / (dim[1] * dim[0]) << "]" << endl;
			o << "circle center = [" << aorta_center_x << ", " << aorta_center_y << ", " << (isCircleFound == 1 ? ostia1 : ostia2) / (dim[1] * dim[0]) << "]" << endl;
			o << "radius = " << (*circles.begin())->GetRadius()[0] * vsize[0] << endl;
			o << (reversedX ? -x : x) << ">0. && -1. < " << (reversedY ? y : -y) << " && " << (reversedY ? y : -y) << " < " << 1. / sqrt(2.) << endl;
			o << "mean HU inside of circle " << mean_HU << endl;
#endif
			if ((reversedX ? -x : x) > 0. && -1. < (reversedY ? y : -y) && (reversedY ? y : -y) < 1. / sqrt(2.)) {
				leftOstia = ostia1;
				rightOstia = ostia2;
#ifdef PRINT_LOG_VTB        
				o << "here 1" << endl;
#endif
			} else {
				leftOstia = ostia2;
				rightOstia = ostia1;
#ifdef PRINT_LOG_VTB      
				o << "here 2" << endl;
#endif
			}
			if (isCircleFound == 2) {
#ifdef PRINT_LOG_VTB
				o << "here 3" << endl;
#endif
				//in the case of slice with second ostia indices are swapped
				int temp = leftOstia;
				leftOstia = rightOstia;
				rightOstia = temp;
			}
#ifdef PRINT_LOG_VTB
			o.close();
#endif
		}
	}

	for (i = 0; i < n; ++i)
		if (Vesselness[i] < 0)
			Vesselness[i] *= -1.;
	if (leftOstia > 0 || rightOstia > 0)
		if (leftOstia != ostia1 || rightOstia != ostia2) // swap branches if it is necessary
			for (i = 0; i < n; i++) {
				if (vesselComponents[i] == 1) vesselComponents[i] = 2;
				else if (vesselComponents[i] == 2) vesselComponents[i] = 1;
			}
}


void VTB::findFirstOstiaPoint() {
	unsigned long long i;
	double maxVal1 = 0;
	ostia1 = -1;

	double temp = 0;
	for (i = 0; i < n; ++i)
		if (nearAortaMask[i]) {
			temp = Vesselness[i];
			if (temp > maxVal1) {
				ostia1 = i;
				maxVal1 = temp;
			}
		}
}

//REWRITTEN
//TODO: CHECK!
void VTB::findSecondOstiaPoint() {
	unsigned long long i;
	double maxVal2 = 0;
	ostia2 = -1;

	double temp = 0;
	for (i = 0; i < n; ++i)
		if (nearAortaMask[i]) {
			if (vesselComponents[i] == 0) {
				temp = Vesselness[i];

				if (temp > maxVal2) {
					ostia2 = i;
					maxVal2 = temp;
				}
			}
		}
}


//REWRITTEN
//TODO CHECK!
unsigned long long VTB::correctOstiaPoint(const char* mode) {
	int vesselMarker;
    if (string(mode) == "left")
		vesselMarker = 1;
    else if (string(mode) == "right")
		vesselMarker = 2;
	else
		assert(1);

	vector <int> N26;
	for (int i = -1; i < 2; ++i)
		for (int ii = -1; ii < 2; ++ii)
			for (int iii = -1; iii < 2; ++iii) {
				int s = abs(i) + abs(ii) + abs(iii);
				if (s > 0) {
					N26.push_back(i + dim[0] * (ii + dim[1] * iii));
				}
			}

	vector< vector <unsigned long long> > comp;
	vector <unsigned long long> coord(3);
	for (unsigned long long i = 0; i < n; ++i) {
		if (vesselComponents[i] == vesselMarker)
			for (int j = 0; j < 26; ++j)
				if (aortaMask[i + N26[j]]) {
					coord[0] = i % dim[0];
					coord[1] = (i / dim[0]) % dim[1];
					coord[2] = i / (dim[0] * dim[1]);
					comp.push_back(coord);
				}
	}

	//TODO если точка устья лежит дальше поверхности аорты:
	//по-хорошему нужно построить distance map и проходить ее по слоям, пока не попадется слой с подходящей ветвью
	if (comp.size() == 0)
		return (vesselMarker == 1 ? leftOstia : rightOstia);

	double x, y, z;
	x = 0; y = 0; z = 0;
	for (unsigned i = 0; i < comp.size(); ++i) {
		x += comp[i][0];
		y += comp[i][1];
		z += comp[i][2];
	}
	x /= comp.size();
	y /= comp.size();
	z /= comp.size();

	int ostia_dist = dim[0];
	unsigned long long new_ostia_ind = 0;
	for (unsigned i = 0; i < comp.size(); ++i) {
		int dist = (x - comp[i][0]) * (x - comp[i][0]) +
			(y - comp[i][1]) * (y - comp[i][1]) +
			(z - comp[i][2]) * (z - comp[i][2]);
		if (dist < ostia_dist) {
			ostia_dist = dist;
			new_ostia_ind = comp[i][0] + dim[0] * (comp[i][1] + dim[1] * comp[i][2]);
		}
	}
	comp.clear();

	return new_ostia_ind;
}


void VTB::takeCrossSection(vector<int> gridCoord, vector<vector<double> > freneFrame,
						   short* imageSlice,
						   bool* sliceMask,
						   unsigned N) {
	// Use Image as base and Frene Frame vectors n b spanning plane as a cross-section
	// create 2N+1 x 2N+1 slice around the voxel gridCoord with the uniform spacing vsize[0]

	double spacing = vsize[0];
	unsigned sliceSize = 2 * N + 1;
	double point[3];

	for (int i = 0; i < sliceSize; i++) {
		for (int j = 0; j < sliceSize; j++) {
			for (int ii = 0; ii < 3; ii++)
				point[ii] = vsize[ii] * gridCoord[ii] + spacing * (freneFrame[1][ii] * (i - (int)N) + freneFrame[2][ii] * (j - (int)N));
			unsigned index[3];
			for (int ii = 0; ii < 3; ii++)
				index[ii] = floor(0.5 + point[ii] / vsize[ii]);

			//interpolate
			imageSlice[i + sliceSize * j] = (short)(floor(0.5 + threeLineInterpolation(point)));
			sliceMask[i + sliceSize * j] = checkSegmentationAtPoint(point);
		}
	}
	return;
}

void VTB::getCentralCrossectionComponent(int sliceSize, bool* sliceMask, vector<unsigned long> component, bool* marked) {
	// inputs: segmented slice sliceMask (2D binary image) of size sliceSize x sliceSize
	// starting in the center of the slice, algorithm grows a connected component
	// outputs: vector of slice indices 
	component.clear();
	vector<unsigned long> front;

	// prepare front and marked
	for (size_t i = 0; i < sliceSize * sliceSize; i++)
		marked[i] = 0;
	front.push_back((sliceSize / 2) * (sliceSize + 1));
	marked[sliceSize * (sliceSize + 1)] = 1;

	//regionGrowing
	unsigned long neighbInd;
	while (!front.empty()) {
		auto currentInd = front.begin();
		front.erase(currentInd);
		component.push_back(*currentInd);
		//check neighbours
		if ((*currentInd) % sliceSize > 0) {
			neighbInd = (*currentInd) - 1;
			if (sliceMask[neighbInd]) { marked[neighbInd] = 1; front.push_back(neighbInd); }
		}
		if ((*currentInd) % sliceSize < sliceSize - 1) {
			neighbInd = (*currentInd) + 1;
			if (sliceMask[neighbInd]) { marked[neighbInd] = 1; front.push_back(neighbInd); }
		}
		if ((*currentInd) / sliceSize > 0) {
			neighbInd = (*currentInd) - sliceSize;
			if (sliceMask[neighbInd]) { marked[neighbInd] = 1; front.push_back(neighbInd); }
		}
		if ((*currentInd) / sliceSize < sliceSize) {
			neighbInd = (*currentInd) + sliceSize;
			if (sliceMask[neighbInd]) { marked[neighbInd] = 1; front.push_back(neighbInd); }
		}
	}
	return;
}


//REWRITTEN
//TODO CHECK!
int VTB::checkSegmentationAtPoint(double point[3]) {
	unsigned index[3];
	for (int i = 0; i < 3; i++)
		index[i] = floor(0.5 + point[i] / vsize[i]);

	//точка вне изображения
	for (int i = 0; i < 3; i++)
		if (index[i] >= dim[i] || index[i] < 0)
			return 0;

	//точка внутри изображения
	if (!vesselComponents) return 0;
	else if (vesselComponents[getIndex(index[0], index[1], index[2])]) return 1;
	return 0;
}


double VTB::threeLineInterpolation(double point[3]) {
	unsigned index[3];
	for (int i = 0; i < 3; i++)
		index[i] = floor(0.5 + point[i] / vsize[i]);
	//точка вне изображения
	for (int i = 0; i < 3; i++)
		if (index[i] >= dim[i] || index[i] < 0)
			return -2000;

	// точка на границе изображения
	// копируем значение из вокселя
	if (index[0] == dim[0] - 1 || index[1] == dim[1] - 1 || index[2] == dim[2] - 1 ||
		index[0] == 0 || index[1] == 0 || index[2] == 0)
		return (double)Image[getIndex(index[0], index[1], index[2])];

	// точка внутри области Image
	// трилинейная интерполяция

	double denominator = 8.0 * vsize[0] * vsize[1] * vsize[2];
	double dx_plus = (1.0 + index[0]) * vsize[0] - point[0];
	double dy_plus = (1.0 + index[1]) * vsize[1] - point[1];
	double dz_plus = (1.0 + index[2]) * vsize[2] - point[2];

	double dx_minus = point[0] - (-1.0 + index[0]) * vsize[0];
	double dy_minus = point[1] - (-1.0 + index[1]) * vsize[1];
	double dz_minus = point[2] - (-1.0 + index[2]) * vsize[2];
	return
		(dx_plus * dy_plus * dz_plus * Image[getIndex(index[0] - 1, index[1] - 1, index[2] - 1)] +
		 dx_plus * dy_plus * dz_minus * Image[getIndex(index[0] - 1, index[1] - 1, index[2] + 1)] +
		 dx_plus * dy_minus * dz_plus * Image[getIndex(index[0] - 1, index[1] + 1, index[2] - 1)] +
		 dx_plus * dy_minus * dz_minus * Image[getIndex(index[0] - 1, index[1] + 1, index[2] + 1)] +
		 dx_minus * dy_plus * dz_plus * Image[getIndex(index[0] + 1, index[1] - 1, index[2] - 1)] +
		 dx_minus * dy_plus * dz_minus * Image[getIndex(index[0] + 1, index[1] - 1, index[2] + 1)] +
		 dx_minus * dy_minus * dz_plus * Image[getIndex(index[0] + 1, index[1] + 1, index[2] - 1)] +
		 dx_minus * dy_minus * dz_minus * Image[getIndex(index[0] + 1, index[1] + 1, index[2] + 1)]) / denominator;
}


void VTB::findMeanAndDeviationInAorta() {
	meanAorta = 0;
	deviationAorta = 0;

	assert(aortaMask != 0);
	size_t aortaPointCount = 0;

	//calculate mean
	for (size_t i = 0; i < n; i++)
		if (aortaMask[i]) {
			meanAorta += Image[i];
			aortaPointCount++;
		}
	meanAorta /= aortaPointCount;

	double meanImage = 0;
	//calculate deviation
	for (size_t i = 0; i < n; i++) {
		if (aortaMask[i])
			deviationAorta += (meanAorta - Image[i]) * (meanAorta - Image[i]) / aortaPointCount;
		meanImage += Image[i];
	}
	deviationAorta = sqrt(deviationAorta);
	meanImage /= n;
#ifdef PRINT_LOG_VTB
	ofstream o;
	o.open("log_aortaMeanDeviation.txt");
	o << "num of points inside of aorta" << aortaPointCount << endl;
	o << "mean = " << meanAorta << endl;
	o << "deviation = " << deviationAorta << endl;
	o << "mean on image = " << meanImage << endl;
	o.close();
#endif

}


double VTB::getWeightFunction(short intensity) {
	if (intensity < 50 || intensity > meanAorta + 7 * deviationAorta) return 0.2;
	else if (intensity < 150) return 0.008 * intensity - 0.2;
	else if (intensity < meanAorta + 3 * deviationAorta) return 1.0;
	else if (intensity < meanAorta + 7 * deviationAorta)
		return 1.0 - (0.2 / deviationAorta) * (intensity - (meanAorta + 3 * deviationAorta));
}


double VTB::functionToArgMin2D(short* crossSection, unsigned crossSize, double spacing,
								vector<unsigned long> centralComponent,
								double a, double b) {
	// inputs: crossection crossSize*crossSize, central component
	// computes function (a,b) to argmin based on the points inside of central component 
	assert(!centralComponent.empty());
	double res, distSquared;
	res = 0;
	double intensity;
	for (auto it = centralComponent.begin(); it != centralComponent.end(); it++) {
		intensity = (double)crossSection[*it];
		//предполагаем, что crossSize/2 содержит центральный элемент
		double dx = (*it) % crossSize;
		double dy = (*it) / crossSize;
		distSquared = (dx - crossSize / 2) * (dx - crossSize / 2) + (dy - crossSize / 2) * (dy - crossSize / 2);
		distSquared *= spacing * spacing;
		res += getWeightFunction(crossSection[*it]) * std::pow(intensity + a * distSquared + b, 2.0);
	}
	return res;
}

void argMinParameters() {

}

double D_paper(int j, int k, int N_paper) {
	double sigma = N_paper;
	sigma = N_paper * N_paper / 16;
	return exp((double)(j - k) / sigma);
}

double A_paper(double area_1, double area_2) {
	double result = area_1 < area_2 ? area_1 / area_2 : area_2 / area_1;
	return pow(result, 1. / 3);
}


/*
vector <unsigned long long> VTB::getVesselCenterline(unsigned long long seed) {
	bool * marked = new bool[n];
	for (auto i = 0; i < n; i++) marked[i] = 0;

	vector<vector<unsigned long long> > trunks;
	vector<unsigned long long> trunk;
	// separate connective component into parts.
	do {
		trunk = sphereRegionGrowing(seed, 36.0, marked);
		if (trunk.size() == 1) break;

	} while (trunk.size() > 1);

	delete[] marked;
}
vector<unsigned long long> VTB::sphereRegionGrowing(unsigned long long seed, double diam, bool* temp_mask) {
	unsigned long long i;
	unsigned long long nbr;

	vector <unsigned long long> output; // intersection of a sphere and vesselness mask
	set<unsigned long long> front;
	//assert(temp_mask != NULL);

	front.insert(seed);
	temp_mask[seed] = 1;
	output.push_back(seed);

	while (!front.empty())
	{
		unsigned long long coord = *front.begin();
		front.erase(front.begin());

		if (!(coord < dim[0] * dim[1]))
		{
			nbr = coord - dim[0] * dim[1];
			if (temp_mask[nbr] == 0 && vesselComponents[nbr] && sqrdDist(seed, nbr)) { temp_mask[nbr] = 1; front.insert(nbr); output.push_back(nbr) }
		}
		if (!((coord / dim[0]) % dim[1] == 0))
		{
			nbr = coord - dim[0];
			if (temp_mask[nbr] == 0 && vesselComponents[nbr] && sqrdDist(seed, nbr)) { temp_mask[nbr] = 1; front.insert(nbr); output.push_back(nbr) }
		}
		if (!(coord%dim[0] == 0))
		{
			nbr = coord - 1;
			if (temp_mask[nbr] == 0 && vesselComponents[nbr] && sqrdDist(seed, nbr)) { temp_mask[nbr] = 1; front.insert(nbr); output.push_back(nbr) }
		}
		if (!(coord%dim[0] == dim[0] - 1))
		{
			nbr = coord + 1;
			if (temp_mask[nbr] == 0 && vesselComponents[nbr] && sqrdDist(seed, nbr)) { temp_mask[nbr] = 1; front.insert(nbr); output.push_back(nbr) }
		}
		if (!((coord / dim[0]) % dim[1] == dim[1] - 1))
		{
			nbr = coord + dim[0];
			if (temp_mask[nbr] == 0 && vesselComponents[nbr] && sqrdDist(seed, nbr)) { temp_mask[nbr] = 1; front.insert(nbr); output.push_back(nbr) }
		}
		if (!(coord >= dim[0] * dim[1] * (dim[2] - 1)))
		{
			nbr = coord + dim[0] * dim[1];
			if (temp_mask[nbr] == 0 && vesselComponents[nbr] && sqrdDist(seed, nbr)) { temp_mask[nbr] = 1; front.insert(nbr); output.push_back(nbr) }
		}
	}

	return output;
}

double VTB::sqrdDist(unsigned long long ind1, unsigned long long ind2) {
	int x1, x2, y1, y2, z1, z2;
	x1 = ind1 % dim[0]; x2 = ind2 % dim[0];
	y1 = ind1 / dim[0] % dim[1]; y2 = ind2 / dim[0] % dim[1];
	z1 = ind1 / dim[0] / dim[1]; z2 = ind2 / dim[0] / dim[1];

	return vsize[0] * vsize[0] * (x1 - x2)*(x1 - x2)
		+ vsize[1] * vsize[1] * (y1 - y2)*(y1 - y2)
		+ vsize[2] * vsize[2] * (z1 - z2)*(z1 - z2);
}
*/

void VTB::printMaskOnMHD(string fileNamePrefix, short* mask) {
	// Print header
	ofstream mhd;
	mhd.open(fileNamePrefix + ".mhd");
	mhd << "ObhectType = Image\nNDims = 3\nDimSize = " << dim[0] << " " << dim[1] << " " << dim[2] << endl;
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
	mhd << "ElementSpacing = " << vsize[0] << " " << vsize[1] << " " << vsize[2] << "\n";
	mhd << "ElementDataFile = segmented_branches.raw\n";
	mhd.close();

	//Print raw data
	ofstream raw;
	raw.open(fileNamePrefix + ".raw");
	for (size_t i = 0; i < n; ++i)
		raw << (mask[i] > 0);
	raw.close();

}


void VTB::getComissuralArcs(double p1[3], double p2[3], double p3[3]) {

	double midPoint[3];
	for (int i = 0; i < 3; i++)
		midPoint[i] = (p1[i] + p2[i] + p3[i]) / 3;
	double normal[3];
	double v12[3] = { p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2] };
	double v13[3] = { p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2] };
	
	Utils::normalize(v12);
	Utils::normalize(v13);

	double Oy[3];
	Utils::vecProd(v12, v13, normal);
	Utils::normalize(normal);
	Utils::vecProd(normal, v12, Oy);

	int halfSize = 200;
	int size[2] = { (2 * halfSize + 1) , (2 * halfSize + 1) };
	unsigned long long usize[2] = { (2 * halfSize + 1) , (2 * halfSize + 1) };

	double cs_spacing[2] = { vsize[0] / 2, vsize[1] / 2 };

	vector <double> _v12({ v12[0],v12[1], v12[2] });
	vector <double> _Oy({ Oy[0],Oy[1], Oy[2] });
	vector <double> _mp({ midPoint[0], midPoint[1], midPoint[2] });
	

	Utils::AGBImage2D* slice = new Utils::AGBImage2D();
	double spacing[2] = {0.1,0.1};
	int halfsize[2] = { 400,400 };
	
	slice->getSliceThroughComissuralPoints(*Image3D, p1, p2, p3, halfsize, spacing);
	
	slice->printOnPng("cross-sections\\comissurial_slice_through.png");
	
	
	
	delete slice;
}


void VTB::getCrossSection(short* crossSection, int halfSize,
						  vector<double> oX, vector<double> oY,
						  vector<double> sliceOrigin,
						  double spacing[2],
						  string mode) {
	ofstream o("cross-sections\\log_get_crossection.txt");
	o << "hafl size = " << halfSize << endl;
	const int size = 2 * halfSize + 1;
	o << "size = " << size << endl;

	short* mask = new short[(halfSize*2 + 1)*(2 * halfSize + 1)];
	o << "spacing = " <<  spacing[0] << " " << spacing[1] << endl;
	Utils::Print3DtoLog( vsize , "vsize", &o);
	Utils::PrintVector3DtoLog( oX , "oX", &o);
	Utils::PrintVector3DtoLog( oY , "oY", &o);
	Utils::PrintVector3DtoLog( sliceOrigin , "sliceOrigin", &o);
	double coord[3], temp_coord[3];
	for (int x = -halfSize; x <= halfSize; x++) {
		// temp_coord in global space along oX axis
		temp_coord[0] = sliceOrigin[0] + oX[0] * (0. + x) * spacing[0];
		temp_coord[1] = sliceOrigin[1] + oX[1] * (0. + x) * spacing[0];
		temp_coord[2] = sliceOrigin[2] + oX[2] * (0. + x) * spacing[0];

		for (int y = -halfSize; y <= halfSize; y++) {
			// coord in image space 
			coord[0] = (temp_coord[0] + oY[0] * (0. + y) * spacing[1]) / vsize[0];
			coord[1] = (temp_coord[1] + oY[1] * (0. + y) * spacing[1]) / vsize[1];
			coord[2] = (temp_coord[2] + oY[2] * (0. + y) * spacing[1]) / vsize[2];
			o << "\n\n";
			Utils::Print3DtoLog(temp_coord, "temp_coord", &o);

			o << x << " " << y << " coord = " << coord[0] << " " << coord[1] << " " << coord[2] << endl;
			o << "ind :" << x + halfSize + size * (y + halfSize) << " < " << size*size << endl ;
			if (coord[0] < 0 || coord[1] < 0 || coord[2] < 0 ||
				coord[0] >= dim[0] || coord[1] >= dim[1] || coord[2] >= dim[2]) {
				crossSection[x + halfSize + size * (y + halfSize)] = -2048; // out of the image cube
				o << "out of box" << endl;
				continue;
			} else {
				// case inside of the image
				o << "get image ind:" << endl;

				std::vector<int> base_voxel({ (int)floor(coord[0]), (int)floor(coord[1]), (int)floor(coord[2]) });
				double weights[3] = { 0, 0, 0 };
				int dir[3] = { 1,1,1 };
				for (int ii = 0; ii < 3; ii++) {
					double diff = coord[ii] - floor(coord[ii]);
					if (diff < 0.5) {
						dir[ii] = -1;
						weights[ii] = 0.5 - diff;
					} else {
						weights[ii] = -0.5 + diff;
					}
				}
				o << "base voxel = [" << base_voxel[0] << ", " << base_voxel[1] << ", " << base_voxel[2] << std::endl;
				Utils::Print3DtoLog(weights,"weigths",&o);
				o << "dir = [" << dir[0] << ", " << dir[1] << ", " << dir[2] << std::endl;

				o << "indices: " <<
					getIndex(base_voxel[0], base_voxel[1], base_voxel[2]) << " " <<
					getIndex(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2]) << " " <<
					getIndex(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2]) << " " <<
					getIndex(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2]) << " " <<
					getIndex(base_voxel[0], base_voxel[1], base_voxel[2] + dir[2]) << " " <<
					getIndex(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2] + dir[2]) << " " <<
					getIndex(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2]) << " " <<
					getIndex(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2]) << endl;

				o << "neighbours: \n" <<
					base_voxel[0] << ", " << base_voxel[1] << ", " << base_voxel[2] << "\n " <<
					base_voxel[0] + dir[0] << ", " << base_voxel[1] << ", " << base_voxel[2] << "\n " <<
					base_voxel[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] << "\n " <<
					base_voxel[0] + dir[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] << "\n " <<
					base_voxel[0] << ", " << base_voxel[1] << ", " << base_voxel[2] + dir[2] << " " <<
					base_voxel[0] + dir[0] << ", " << base_voxel[1] << ", " << base_voxel[2] + dir[2] << "\n " <<
					base_voxel[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] + dir[2] << "\n " <<
					base_voxel[0] + dir[0] << ", " << base_voxel[1] + dir[1] <<", " << base_voxel[2] + dir[2] << endl<< endl;

				short x000 = Image[getIndex(base_voxel[0], base_voxel[1], base_voxel[2])];
				short x001 = Image[getIndex(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2])];
				short x010 = Image[getIndex(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2])];
				short x011 = Image[getIndex(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2])];
				short x100 = Image[getIndex(base_voxel[0], base_voxel[1], base_voxel[2] + dir[2])];
				short x101 = Image[getIndex(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2] + dir[2])];
				short x110 = Image[getIndex(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2])];
				short x111 = Image[getIndex(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2])];

				o << "intensities:\n";
				o << x000 << " " << x001 << " " << x010 << " " << x011 << "\n";
				o << x100 << " " << x101 << " " << x110 << " " << x111 << "\n";

				double res =
					x000 * (1. - weights[0]) * (1. - weights[1]) * (1. - weights[2]) +
					x001 * weights[0] * (1. - weights[1]) * (1. - weights[2]) +
					x010 * (1. - weights[0]) * weights[1] * (1. - weights[2]) +
					x011 * weights[0] * weights[1] * (1. - weights[2]) +
					x100 * (1. - weights[0]) * (1. - weights[1]) * weights[2] +
					x101 * weights[0] * (1. - weights[1]) * weights[2] +
					x110 * (1. - weights[0]) * weights[1] * weights[2] +
					x111 * weights[0] * weights[1] * weights[2];
				o << "res = " << res << endl;
				crossSection[x + halfSize + size * (y + halfSize)] = (short)floor(res);
				mask[x + halfSize + size * (y + halfSize)] = 
					(short)aortaMask[getIndex(base_voxel[0], base_voxel[1], base_voxel[2])];
				//int indImage = getIndex(floor(coord[0]), floor(coord[1]), floor(coord[2]));
				//o << "    " << indImage << " < " << n;
				//crossSection[x + halfSize + size * (y + halfSize)] = Image[indImage];

			}
		}
	}
	o << "DONE" << endl;
	o.close();
	double cs_spacing[2] = { vsize[0] / 2, vsize[1] / 2 };
	int size_[2] = { (2 * halfSize + 1) , (2 * halfSize + 1) };

	Utils::printSliceOnPng("cross-sections\\mask_slice.png", mask, size_, cs_spacing);
	delete[]mask;
}



