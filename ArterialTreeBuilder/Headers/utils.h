#ifndef VTB_UTILS_H
#define VTB_UTILS_H

#include <vector>
#include <math.h>
#include <imgaussian.hpp>

namespace Utils {

	double getAngle(double origin[2], double point[2]);

	struct FreneFrame {
		std::vector<double> t; // tangential vector
		std::vector<double> n; // normal vector
		std::vector<double> b; // binormal vector
	};

	struct MinRotationFrame {
		std::vector<double> t; // tangential vector
		std::vector<double> f; // cross-section first vector
		std::vector<double> g; // cross-section second vector
	};

	struct CurveParametrized {
		int numberOfPoints;
		std::vector<double> parameter;
		std::vector<std::vector<double> > points;
		std::vector<FreneFrame> frames;
		std::vector<MinRotationFrame> minFrames;
		std::vector<std::vector<double> > secondDerivatives;
	};

	void writeMaskOnSTL(bool* mask, unsigned long long dim[3], double vsize[3], double origin[3], std::string name_prefix);

	void Print3DtoLog(double a[3], std::string prefix, std::ofstream* o);

	/*
	void Print3ItoLog(int a[3], std::string prefix, std::ofstream* o) ;
	*/
	void PrintVector3DtoLog(std::vector<double> a, std::string prefix, std::ofstream* o);
	/*
	void PrintVector3ItoLog(std::vector<int> a, std::string prefix, std::ofstream* o) ; */

	double lengthSqrd(double vec[3]);
	double length(double vec[3]);
	double length(double a, double b, double c);
	double normalize(double vec[3]);
	double normalizeV(std::vector<double> vec);

	double dotProd(double vecA[3], double vecB[3]);
	void crossProd(double vecA[3], double vecB[3], double vecRes[3]);

	double dotProdV(std::vector<double> vecA, std::vector<double> vecB);
	void crossProdV(std::vector<double> vecA, std::vector<double> vecB, double res[3]);
	void vecProd(double vecA[3], double vecB[3], double vecProd[3]);
	double pointDist(std::vector<double> A, std::vector<double> B);
	double pointDistD(double A[3], double B[3]);
	double pointDistSqrd(std::vector<double> A, std::vector<double> B);


	class bSplineApproxMulti {
		/// Class for approximation of skeleton with a 3d spline curve.
		/// BA and basic MBA methods: 
		/// Seungyong Lee. et al. Scattered Data Interpolation with Multilevel B - Splines
		/// doi: 10.1109/2945.620490

		/// Inputs:
		/// 1) _segmentsRange -- range of bSpline uniform grids  [start, max_degree]
		///    generates number of grid knots: start * 2^i  for i=0 ... max_degree-1
		/// 2) _centerline -- skeleton points
		///
		/// Algorithm:
		/// 1) get skeleton semi-natural parametrization {x(t), y(t), z(t)}
		/// 2) extend skeleton byound its begin and end
		/// 3) apply basic multiscale MBA algorithm to extended sceleton

		/// Public API:
		///	getSplineCurve ()                   -- get approximated B-spline curve
		/// getSplineCurveFirstDerivatives()    -- get first derivatives of approximated B-spline curve
		/// getSplineCurveSecondDerivatives()   -- get second derivatives of approximated B-spline curve

		// TODO сделать функции, которые возвращают натурально параметризованные кривые

	private:
		std::vector < std::vector<double> >  diffAtPoints; // updates on every stage
		std::vector <unsigned> segmentsCount;

		std::vector <double> knotStep;
		std::vector <std::vector<double> > knots;

		std::vector<std::vector<double> > weights_x;
		std::vector<std::vector<double> > weights_y;
		std::vector<std::vector<double> > weights_z;

		int numOfCNTPoints;
		int numOfAdditoryPoints;
		int totalNumOfPoints;
		std::vector<std::vector <double > > centerline;

		double interpolationThreshold;

		std::vector<double> parameter;
		CurveParametrized* outputCurve;
		//ofstream log;

	public:
		bSplineApproxMulti(unsigned segmentsRange[2], std::vector<std::vector<double> >& _centerline) {
			std::ofstream log("log_spline.txt");
			log << "copy centerline" << std::endl;
			centerline.clear();
			numOfCNTPoints = _centerline.size();
			for (auto ipoint = _centerline.begin(); ipoint != _centerline.end(); ipoint++) {
				std::vector <double> coord(3);
				for (int i = 0; i < 3; i++) {
					coord[i] = (*ipoint)[i];
				}
				centerline.push_back(coord);
				diffAtPoints.push_back(coord);
			}

			log << "copy centerline -- done\n" << std::endl;

			for (unsigned is = 0; is < segmentsRange[1]; is += 1) {
				segmentsCount.push_back(segmentsRange[0] * pow(2.0, double(is)));
				// cout << "copy segments count " << *(segmentsCount.end() - 1) << std::endl;
			}

			// compute parametrization of the centerline scattered points
			log << "getParametrization" << std::endl;
			getParametrization();
			log << "getParametrization -- done\n" << std::endl;
			log << "\n interpolation threshold = " << interpolationThreshold << std::endl;
			log << " number of required points > " << (*(parameter.end() - 1)) / interpolationThreshold << std::endl;
			log << " actual number points > " << *(segmentsCount.end() - 1) << std::endl;
			// enlarge centerline 
			numOfAdditoryPoints = 2;

			std::vector <double> beginAdditoryPoints(numOfAdditoryPoints);
			std::vector <double> beginAdditoryTime(numOfAdditoryPoints);
			double dtEnd = *(parameter.end() - 1) - *(parameter.end() - 2);
			double dtBegin = *(parameter.begin() + 1);
			auto pointBegin = *(centerline.begin());
			auto pointEnd = *(centerline.end() - 1);

			log << "parameter.size before = " << parameter.size() << std::endl;
			for (int i = 0; i < numOfAdditoryPoints; i++) {
				centerline.push_back(pointEnd);
				diffAtPoints.push_back(pointEnd);
				parameter.push_back(*(parameter.end() - 1) + dtEnd);

				centerline.insert(centerline.begin(), pointBegin);
				diffAtPoints.insert(diffAtPoints.begin(), pointBegin);
				parameter.insert(parameter.begin(), (*parameter.begin()) - dtBegin);
			}
			log << "parameter.size after = " << parameter.size() << std::endl;

			totalNumOfPoints = centerline.size();

			log << "alocate knots, weights" << std::endl;
			knots.resize(segmentsCount.size());
			knotStep.resize(segmentsCount.size());

			weights_x.resize(segmentsCount.size());
			weights_y.resize(segmentsCount.size());
			weights_z.resize(segmentsCount.size());

			// allocate knots and weights
			for (int is = 0; is < segmentsCount.size(); is++) {

				knots[is].resize(segmentsCount[is] + 3);
				weights_x[is].resize(segmentsCount[is] + 3);
				weights_y[is].resize(segmentsCount[is] + 3);
				weights_z[is].resize(segmentsCount[is] + 3);

				log << "alocate knots, weights -- done\n" << std::endl;


				// cout << "set knots" << std::endl;
				// knots indices = -1, 0, ..., numKnots+1
				// knots[1] must be qual to parameter[0] = 0
				// knots[segmentsCount + 1] = parameter[numOfCNTPoints-1];
				knotStep[is] = (parameter[totalNumOfPoints - 1] + 1e-8 - parameter[0]) / segmentsCount[is];


				for (int i = 0; i < segmentsCount[is] + 3; i++)
					knots[is][i] = knotStep[is] * (-1.0 - numOfAdditoryPoints + i);
				log << "set knots -- done\n" << std::endl;

				// compute weights for current knot grid
				// cout << "BA algorithm" << std::endl;
				BAalgorithm(is);
				log << "BA algorithm -- done" << std::endl;


				log << "update diff at points " << std::endl;
				for (auto ii = 0; ii < totalNumOfPoints; ii++) {
					diffAtPoints[ii][0] -= getApproximationAtPoint(parameter[ii], is)[0];
					diffAtPoints[ii][1] -= getApproximationAtPoint(parameter[ii], is)[1];
					diffAtPoints[ii][2] -= getApproximationAtPoint(parameter[ii], is)[2];
				}
				log << "update diff at points --- done" << std::endl;
			}
			log << "MBA FINNISHED" << std::endl;
			log.close();
		}

		~bSplineApproxMulti() {
			knots.clear();
			weights_x.clear();
			weights_y.clear();
			weights_z.clear();
			parameter.clear();
			centerline.clear();
		};

	private:
		void getParametrization() {
			parameter.clear();

			interpolationThreshold = -1;
			parameter.push_back(0);
			for (int i = 1; i < numOfCNTPoints; i++) {
				double dist = Utils::pointDist(centerline[i], centerline[i - 1]);
				parameter.push_back(parameter[i - 1] + dist);
				if (dist > interpolationThreshold)
					interpolationThreshold = dist;
			}
			interpolationThreshold /= 4;
		};


		void BAalgorithm(const int iscale) {
			// computes weights with the algorithm from the original paper
			// cout << "    BA alogrithm:" << std::endl;
			// cout << "		allocate deltas, omega:" << std::endl;
			double* delta_x = new double[segmentsCount[iscale] + 3]; // accumulator for numerators of weights
			double* delta_y = new double[segmentsCount[iscale] + 3]; // accumulator for numerators of weights
			double* delta_z = new double[segmentsCount[iscale] + 3]; // accumulator for numerators of weights

			double* omega = new double[segmentsCount[iscale] + 3]; // accumulator for denominators of weights

			for (int i = 0; i < segmentsCount[iscale] + 3; i++) {
				delta_x[i] = 0;
				delta_y[i] = 0;
				delta_z[i] = 0;
				omega[i] = 0;
			}

			double w[4] = { 0,0,0,0 };
			for (int ip = 0; ip < totalNumOfPoints; ip++) {
				double tmp_t = (parameter[ip] - parameter[0]) / knotStep[iscale];
				int i = floor(tmp_t); // в статье на 1 меньше, но там индексация от -1

				double arg_t = tmp_t - floor(tmp_t);

				w[0] = BF_0(arg_t), w[1] = BF_1(arg_t), w[2] = BF_2(arg_t), w[3] = BF_3(arg_t);

				double wsum2 = w[0] * w[0] + w[1] * w[1] + w[2] * w[2] + w[3] * w[3];

				for (int k = 0; k < 4; k++) {
					double w2 = w[k] * w[k];
					delta_x[i + k] += w2 * (w[k] * diffAtPoints[ip][0]) / wsum2;
					delta_y[i + k] += w2 * (w[k] * diffAtPoints[ip][1]) / wsum2;
					delta_z[i + k] += w2 * (w[k] * diffAtPoints[ip][2]) / wsum2;

					omega[i + k] += w2;
				}
			}

			for (int i = 0; i < segmentsCount[iscale] + 3; i++) {
				if (fabs(omega[i]) > 1e-6) {
					weights_x[iscale][i] = delta_x[i] / omega[i];
					weights_y[iscale][i] = delta_y[i] / omega[i];
					weights_z[iscale][i] = delta_z[i] / omega[i];
				} else
					weights_x[iscale][i] = 0;
			}

			delete[]omega;
			delete[]delta_x;
			delete[]delta_y;
			delete[]delta_z;
		}

		// FUNCTIONS
		// Basis functions of the 3rd degree B-Spline 
		double BF_0(double t) { return pow(1.0 - t, 3.0) / 6; };
		double BF_1(double t) { return t * t * (0.5 * t - 1.) + 2. / 3; };
		double BF_2(double t) { return 0.5 * t * (-t * t + t + 1) + 1. / 6; };
		double BF_3(double t) { return pow(t, 3) / 6; };

		// First derivatives
		double BF_0_d(double t) { return -0.5 * (1.0 - t) * (1.0 - t); };
		double BF_1_d(double t) { return 1.5 * t * t - 2 * t; };
		double BF_2_d(double t) { return -1.5 * t * t + t + 0.5; };
		double BF_3_d(double t) { return t * t / 2; };

		// Second derivatives
		double BF_0_dd(double t) { return 1.0 - t; };
		double BF_1_dd(double t) { return 3.0 * t - 2; };
		double BF_2_dd(double t) { return 1. - 3. * t; };
		double BF_3_dd(double t) { return t; };

	public:
		std::vector<double> getApproximationAtPoint(double t, int iscale) {
			double tmp_t = (t - parameter[0]) / knotStep[iscale];
			double basis_func_arg = tmp_t - floor(tmp_t);

			int floorKnotID = floor(tmp_t);
			assert(floorKnotID > -1);

			std::vector <double> res(3);
			res[0] = BF_0(basis_func_arg) * weights_x[iscale][floorKnotID + 0] +
				BF_1(basis_func_arg) * weights_x[iscale][floorKnotID + 1] +
				BF_2(basis_func_arg) * weights_x[iscale][floorKnotID + 2] +
				BF_3(basis_func_arg) * weights_x[iscale][floorKnotID + 3];

			res[1] = BF_0(basis_func_arg) * weights_y[iscale][floorKnotID + 0] +
				BF_1(basis_func_arg) * weights_y[iscale][floorKnotID + 1] +
				BF_2(basis_func_arg) * weights_y[iscale][floorKnotID + 2] +
				BF_3(basis_func_arg) * weights_y[iscale][floorKnotID + 3];

			res[2] = BF_0(basis_func_arg) * weights_z[iscale][floorKnotID + 0] +
				BF_1(basis_func_arg) * weights_z[iscale][floorKnotID + 1] +
				BF_2(basis_func_arg) * weights_z[iscale][floorKnotID + 2] +
				BF_3(basis_func_arg) * weights_z[iscale][floorKnotID + 3];

			return res;
		};


		std::vector<double> getFirstDerivativeAtPoint(double t, int iscale) {
			double tmp_t = (t - parameter[0]) / knotStep[iscale];
			double basis_func_arg = tmp_t - floor(tmp_t);

			int floorKnotID = floor(tmp_t);
			//if (floorKnotID == segmentsCount[iscale])
			//	floorKnotID--;
			assert(floorKnotID > -1);

			std::vector <double> res(3);
			res[0] = BF_0_d(basis_func_arg) * weights_x[iscale][floorKnotID + 0] +
				BF_1_d(basis_func_arg) * weights_x[iscale][floorKnotID + 1] +
				BF_2_d(basis_func_arg) * weights_x[iscale][floorKnotID + 2] +
				BF_3_d(basis_func_arg) * weights_x[iscale][floorKnotID + 3];

			res[1] = BF_0_d(basis_func_arg) * weights_y[iscale][floorKnotID + 0] +
				BF_1_d(basis_func_arg) * weights_y[iscale][floorKnotID + 1] +
				BF_2_d(basis_func_arg) * weights_y[iscale][floorKnotID + 2] +
				BF_3_d(basis_func_arg) * weights_y[iscale][floorKnotID + 3];

			res[2] = BF_0_d(basis_func_arg) * weights_z[iscale][floorKnotID + 0] +
				BF_1_d(basis_func_arg) * weights_z[iscale][floorKnotID + 1] +
				BF_2_d(basis_func_arg) * weights_z[iscale][floorKnotID + 2] +
				BF_3_d(basis_func_arg) * weights_z[iscale][floorKnotID + 3];

			return res;
		};


		std::vector<double> getSecondDerivativeAtPoint(double t, int iscale) {
			double tmp_t = (t - parameter[0]) / knotStep[iscale];
			double basis_func_arg = tmp_t - floor(tmp_t);

			int floorKnotID = floor(tmp_t);
			//if (floorKnotID == segmentsCount[iscale])
			//	floorKnotID--;
			assert(floorKnotID > -1);

			std::vector <double> res(3);
			res[0] = BF_0_d(basis_func_arg) * weights_x[iscale][floorKnotID + 0] +
				BF_1_dd(basis_func_arg) * weights_x[iscale][floorKnotID + 1] +
				BF_2_dd(basis_func_arg) * weights_x[iscale][floorKnotID + 2] +
				BF_3_dd(basis_func_arg) * weights_x[iscale][floorKnotID + 3];

			res[1] = BF_0_dd(basis_func_arg) * weights_y[iscale][floorKnotID + 0] +
				BF_1_dd(basis_func_arg) * weights_y[iscale][floorKnotID + 1] +
				BF_2_dd(basis_func_arg) * weights_y[iscale][floorKnotID + 2] +
				BF_3_dd(basis_func_arg) * weights_y[iscale][floorKnotID + 3];

			res[2] = BF_0_dd(basis_func_arg) * weights_z[iscale][floorKnotID + 0] +
				BF_1_dd(basis_func_arg) * weights_z[iscale][floorKnotID + 1] +
				BF_2_dd(basis_func_arg) * weights_z[iscale][floorKnotID + 2] +
				BF_3_dd(basis_func_arg) * weights_z[iscale][floorKnotID + 3];

			return res;
		};


		std::vector <std::vector< double> > getSplineCurve() {
			std::vector <std::vector <double> > res;
			double finest_step = *(knotStep.end() - 1);
			std::vector<double> accum(3);
			for (double t = 0; t < parameter[numOfCNTPoints + numOfAdditoryPoints - 1]; t += finest_step / 10) {

				accum[0] = accum[1] = accum[2] = 0;
				for (int iscale = 0; iscale < knotStep.size(); iscale++) {
					auto approx = getApproximationAtPoint(t, iscale);
					accum[0] += approx[0];
					accum[1] += approx[1];
					accum[2] += approx[2];
				}
				res.push_back(accum);
			}
			return res;
		}


		std::vector <std::vector <double> > getSplineCurveFirstDerivatives() {
			std::vector <std::vector <double> > res;
			double finest_step = *(knotStep.end() - 1);
			std::vector<double> accum(3);
			for (double t = 0; t < parameter[numOfCNTPoints + numOfAdditoryPoints - 1]; t += finest_step / 10) {

				accum[0] = accum[1] = accum[2] = 0;
				for (int iscale = 0; iscale < knotStep.size(); iscale++) {
					auto approx = getFirstDerivativeAtPoint(t, iscale);
					accum[0] += approx[0];
					accum[1] += approx[1];
					accum[2] += approx[2];
				}
				res.push_back(accum);
			}
			return res;
		};


		std::vector <std::vector <double> > getSplineCurveSecondDerivatives() {
			std::vector <std::vector <double> > res;
			double finest_step = *(knotStep.end() - 1);
			std::vector<double> accum(3);
			for (double t = 0; t < parameter[numOfCNTPoints + numOfAdditoryPoints - 1]; t += finest_step / 10) {

				accum[0] = accum[1] = accum[2] = 0;
				for (int iscale = 0; iscale < knotStep.size(); iscale++) {
					auto approx = getSecondDerivativeAtPoint(t, iscale);
					accum[0] += approx[0];
					accum[1] += approx[1];
					accum[2] += approx[2];
				}
				res.push_back(accum);
			}
			return res;
		};


		CurveParametrized* getNaturalCurveWithFreneFrames() {
			std::ofstream log("log_getNaturalCurveWithFreneFrames.txt");
			log << "generateNaturalParametrization" << std::endl;
			generateNaturalParametrization();
			log << "done" << std::endl;
			log << "getFreneFrames" << std::endl;

			getFreneFrames();
			log << "done!" << std::endl;

			log << "getMinRotationFrames" << std::endl;
			getMinRotationFrames();
			log << "getMinRotationFrames -- done" << std::endl;


			log << "returning centerline -- all done!" << std::endl;
			log.close();
			return outputCurve;
		};


		void WriteSplineToPythonFile() {
			std::ofstream o("print_spline_scales_" + std::to_string(knotStep.size()) + ".py");

			o << "import matplotlib.pyplot as plt\n";
			o << "from mpl_toolkits import mplot3d\n";
			o << "t = []\nx = []\ny = []\nz = []\nsx = []\nsy = []\nsz = []\nts = []\n";
			for (int i = numOfAdditoryPoints; i < numOfCNTPoints + numOfAdditoryPoints; i++) {
				o << "x.append(" << centerline[i][0] << ")\ny.append(" << centerline[i][1] << ")" << std::endl;
				o << "z.append(" << centerline[i][2] << ")\nt.append(" << parameter[i] << ")" << std::endl;
			}

			double finest_step = *(knotStep.end() - 1);
			std::vector<double> accum(3);
			for (double t = 0; t < parameter[numOfCNTPoints + numOfAdditoryPoints - 1]; t += finest_step / 10) {

				accum[0] = accum[1] = accum[2] = 0;
				for (int iscale = 0; iscale < knotStep.size(); iscale++) {
					auto approx = getApproximationAtPoint(t, iscale);
					accum[0] += approx[0];
					accum[1] += approx[1];
					accum[2] += approx[2];
				}

				o << "sx.append(" << accum[0] << ")\n";
				o << "sy.append(" << accum[1] << ")\n";
				o << "sz.append(" << accum[2] << ")\n";
				o << "ts.append(" << t << ")\n";
			}

			o << "ax_x = plt.subplot(2, 2, 1)\n";
			o << "ax_y = plt.subplot(2, 2, 2)\n";
			o << "ax_z = plt.subplot(2, 2, 3)\n";
			o << "ax_3d = plt.subplot(2, 2, 4,projection=\'3d\')\n";

			o << "ax_x.scatter(t,x,c='red')\n";
			o << "ax_y.scatter(t,y,c='red')\n";
			o << "ax_z.scatter(t,z,c='red')\n";

			o << "ax_x.plot (ts,sx, 'b-')\n";
			o << "ax_y.plot (ts,sy, 'b-')\n";
			o << "ax_z.plot (ts,sz, 'b-')\n";

			o << "ax_3d.plot3D (sx,sy,sz, 'b-')\n";
			o << "ax_3d.scatter3D(x,y,z,c='red')\n";

			o << "plt.show()\n";
			o.close();
		}


		void WriteFreneFramesToPythonFile() {
			std::ofstream o("print_frames.py");

			o << "import matplotlib.pyplot as plt\n";
			o << "from mpl_toolkits import mplot3d\n";
			o << "\nnxb = []\nnyb = []\nnzb = []\nnxe = []\nnye = []\nnze = []" << std::endl;
			o << "\nbxb = []\nbyb = []\nbzb = []\nbxe = []\nbye = []\nbze = []" << std::endl;
			for (int i = 0; i < outputCurve->numberOfPoints; i++) {
				o << "nxb.append(" << outputCurve->points[i][0] << ")" << std::endl;
				o << "bxb.append(" << outputCurve->points[i][0] << ")" << std::endl;
				o << "nyb.append(" << outputCurve->points[i][1] << ")" << std::endl;
				o << "byb.append(" << outputCurve->points[i][1] << ")" << std::endl;
				o << "nzb.append(" << outputCurve->points[i][2] << ")" << std::endl;
				o << "bzb.append(" << outputCurve->points[i][2] << ")" << std::endl;


				o << "nxe.append(" << outputCurve->frames[i].n[0] << ")" << std::endl;
				o << "bxe.append(" << outputCurve->frames[i].b[0] << ")" << std::endl;
				o << "nye.append(" << outputCurve->frames[i].n[1] << ")" << std::endl;
				o << "bye.append(" << outputCurve->frames[i].b[1] << ")" << std::endl;
				o << "nze.append(" << outputCurve->frames[i].n[2] << ")" << std::endl;
				o << "bze.append(" << outputCurve->frames[i].b[2] << ")" << std::endl;
			}


			o << "ax_3d = plt.subplot(projection=\'3d\')\n";

			o << "ax_3d.quiver(nxb, nyb, nzb, nxe, nye, nze, color='blue')\n";
			o << "ax_3d.quiver(bxb, byb, bzb, bxe, bye, bze, color='green')\n";
			o << "ax_3d.scatter3D(nxb,nyb,nzb,c='red')\n";

			o << "plt.show()\n";
			o.close();
		};

		void WriteMinRotationFramesToPythonFile() {
			std::ofstream o("print_min_rotation_frames.py");

			o << "import matplotlib.pyplot as plt\n";
			o << "from mpl_toolkits import mplot3d\n";
			o << "\nnxb = []\nnyb = []\nnzb = []\nnxe = []\nnye = []\nnze = []" << std::endl;
			o << "\nbxb = []\nbyb = []\nbzb = []\nbxe = []\nbye = []\nbze = []" << std::endl;
			for (int i = 0; i < outputCurve->numberOfPoints; i++) {
				o << "nxb.append(" << outputCurve->points[i][0] << ")" << std::endl;
				o << "bxb.append(" << outputCurve->points[i][0] << ")" << std::endl;
				o << "nyb.append(" << outputCurve->points[i][1] << ")" << std::endl;
				o << "byb.append(" << outputCurve->points[i][1] << ")" << std::endl;
				o << "nzb.append(" << outputCurve->points[i][2] << ")" << std::endl;
				o << "bzb.append(" << outputCurve->points[i][2] << ")" << std::endl;


				o << "nxe.append(" << outputCurve->minFrames[i].f[0] << ")" << std::endl;
				o << "bxe.append(" << outputCurve->minFrames[i].g[0] << ")" << std::endl;
				o << "nye.append(" << outputCurve->minFrames[i].f[1] << ")" << std::endl;
				o << "bye.append(" << outputCurve->minFrames[i].g[1] << ")" << std::endl;
				o << "nze.append(" << outputCurve->minFrames[i].f[2] << ")" << std::endl;
				o << "bze.append(" << outputCurve->minFrames[i].g[2] << ")" << std::endl;
			}


			o << "ax_3d = plt.subplot(projection=\'3d\')\n";

			o << "ax_3d.quiver(nxb, nyb, nzb, nxe, nye, nze, color='blue')\n";
			o << "ax_3d.quiver(bxb, byb, bzb, bxe, bye, bze, color='green')\n";
			o << "ax_3d.scatter3D(nxb,nyb,nzb,c='red')\n";

			o << "plt.show()\n";
			o.close();
		};


	private:
		void getFreneFrames() {
			outputCurve->frames.clear();
			outputCurve->frames.resize(outputCurve->numberOfPoints);
			std::vector<double> nu(3);
			std::vector<double> tau(3);
			std::vector<double> beta(3);

			std::vector<std::vector<double>> Dt(outputCurve->numberOfPoints);
			std::vector<std::vector<double>> Dtt(outputCurve->numberOfPoints);

			std::vector<double> p1, p2;
			double t1, t2;

			// cout << "compute first derivatives" << std::endl;
			// compute first derivatives
			for (size_t i = 0; i < outputCurve->numberOfPoints; i++) {
				std::vector <double> diff;

				if (i == 0) {
					p1 = outputCurve->points[i];
					p2 = outputCurve->points[i + 1];

					t1 = outputCurve->parameter[i];
					t2 = outputCurve->parameter[i + 1];
				} else if (i == outputCurve->numberOfPoints - 1) {
					p1 = outputCurve->points[i - 1];
					p2 = outputCurve->points[i];

					t1 = outputCurve->parameter[i - 1];
					t2 = outputCurve->parameter[i];
				} else {
					p1 = outputCurve->points[i - 1];
					p2 = outputCurve->points[i + 1];

					t1 = outputCurve->parameter[i - 1];
					t2 = outputCurve->parameter[i + 1];
				}

				double norm = 0;
				std::vector <double> tmp_t(3);
				for (int j = 0; j < 3; j++) {
					double tmp = (p2[j] - p1[j]) / (t2 - t1);
					tmp_t[j] = tmp;
					norm += tmp * tmp;
				}

				outputCurve->frames[i].t = tmp_t;
				norm = sqrt(norm);
			}
			// cout << "compute first derivatives -- done!" << std::endl;

			// cout << "compute second derivatives" << std::endl;
			for (size_t i = 0; i < outputCurve->numberOfPoints; i++) {
				std::vector <double> diff;

				if (i == 0) {
					p1 = outputCurve->frames[i].t;
					p2 = outputCurve->frames[i + 1].t;

					t1 = outputCurve->parameter[i];
					t2 = outputCurve->parameter[i + 1];
				} else if (i == outputCurve->numberOfPoints - 1) {
					p1 = outputCurve->frames[i - 1].t;
					p2 = outputCurve->frames[i].t;

					t1 = outputCurve->parameter[i - 1];
					t2 = outputCurve->parameter[i];
				} else {
					p1 = outputCurve->frames[i - 1].t;
					p2 = outputCurve->frames[i + 1].t;

					t1 = outputCurve->parameter[i - 1];
					t2 = outputCurve->parameter[i + 1];
				}

				double norm = 0;
				std::vector <double> tmp_n(3);

				for (int j = 0; j < 3; j++) {
					double tmp = (p2[j] - p1[j]) / (t2 - t1);
					tmp_n[j] = tmp;
					norm += tmp * tmp;
				}
				outputCurve->secondDerivatives.push_back(tmp_n);
				norm = sqrt(norm);

				assert(fabs(norm) > 1e-8);
				for (int j = 0; j < 3; j++)
					tmp_n[j] /= norm;
				outputCurve->frames[i].n = tmp_n;


				std::vector <double>tmp_b(3);
				auto t = outputCurve->frames[i].t;
				for (int j = 0; j < 3; j++) {
					tmp_b[j] = t[(j + 1) % 3] * tmp_n[(j + 2) % 3] - t[(j + 2) % 3] * tmp_n[(j + 1) % 3];
				}
				outputCurve->frames[i].b = tmp_b;

			}
			// cout << "compute second derivatives -- done!" << std::endl;
		}

		void generateNaturalParametrization() {
			outputCurve = new CurveParametrized();
			outputCurve->parameter.push_back(0);
			std::vector <double> accum({ 0,0,0 });
			for (int iscale = 0; iscale < knotStep.size(); iscale++) {
				auto approx = getApproximationAtPoint(0, iscale);
				accum[0] += approx[0];
				accum[1] += approx[1];
				accum[2] += approx[2];
			}
			outputCurve->points.push_back(accum);


			double step = (*(knotStep.end() - 1)) / 10;
			for (double t = step; t < parameter[numOfCNTPoints + numOfAdditoryPoints - 1] + step; t += step) {
				auto prevPoint = *(outputCurve->points.end() - 1);
				auto prevParam = *(outputCurve->parameter.end() - 1);


				accum[0] = accum[1] = accum[2] = 0;
				double nextParam = t;

				for (int iscale = 0; iscale < knotStep.size(); iscale++) {
					auto approx = getApproximationAtPoint(nextParam, iscale);
					accum[0] += approx[0];
					accum[1] += approx[1];
					accum[2] += approx[2];
				}

				outputCurve->points.push_back(accum);

				double newCurveSegmentLen = Utils::pointDist(prevPoint, accum);
				outputCurve->parameter.push_back(prevParam + newCurveSegmentLen);
				outputCurve->numberOfPoints = outputCurve->parameter.size();
			}
		};

		void getMinRotationFrames() {
			// solve ODE for f and for g with Eiler method to minimize rotation of the frame (t,f,g)
			// v'(s) = - (  (gamma'' (s), v(s)) * gamma'(s) / ||gamma'(s)||
			// v(0)  = f_0 (analogical with g_0) 
			// where 
			// gamma = parametrized curve
			// s     = parameter (any parameter)

			std::ofstream log("log_getMinRotationFrames.txt");
			log << "clear frames" << std::endl;
			outputCurve->minFrames.clear();

			std::vector<double> f_0(3), g_0(3), tangent(3);
			f_0 = outputCurve->frames[0].n;
			g_0 = outputCurve->frames[0].b;

			std::vector<double> f_i(3), f_i_plus(3);
			std::vector<double> g_i(3), g_i_plus(3);

			log << "prepare" << std::endl;

			// initial step
			MinRotationFrame init_frame;
			init_frame.t = outputCurve->frames[0].t;
			init_frame.f = f_0;
			init_frame.g = g_0;
			outputCurve->minFrames.push_back(init_frame);

			f_i = f_0;
			g_i = g_0;

			log << "prepare done\n\nmainloop" << std::endl;

			// main loop
			for (int i = 1; i < outputCurve->numberOfPoints; i++) {
				log << "    i = " << i << std::endl;

				double h = outputCurve->parameter[i] - outputCurve->parameter[i - 1];
				log << "    h = " << h << std::endl;

				f_i = outputCurve->minFrames[i - 1].f;
				g_i = outputCurve->minFrames[i - 1].g;
				tangent = outputCurve->frames[i - 1].t;

				Utils::PrintVector3DtoLog(f_i, "f_i", &log);
				Utils::PrintVector3DtoLog(g_i, "g_i", &log);
				Utils::PrintVector3DtoLog(tangent, "tangent", &log);

				std::vector <double> ddt(3);
				ddt = outputCurve->secondDerivatives[i];

				Utils::PrintVector3DtoLog(ddt, "ddt", &log);

				double f_coeff = -Utils::dotProdV(ddt, f_i);
				double g_coeff = -Utils::dotProdV(ddt, g_i);

				log << "f_coeff = " << f_coeff << ", g_coeff" << g_coeff << std::endl;
				for (int j = 0; j < 3; j++) {
					f_i_plus[j] = f_i[j] + h * f_coeff * tangent[j];
					g_i_plus[j] = g_i[j] + h * g_coeff * tangent[j];
				}

				Utils::PrintVector3DtoLog(f_i_plus, "f_i_plus", &log);
				Utils::PrintVector3DtoLog(g_i_plus, "g_i_plus", &log);

				log << "push new frame " << std::endl;
				MinRotationFrame new_frame;
				new_frame.t = outputCurve->frames[i].t;
				new_frame.f = f_i_plus;
				new_frame.g = g_i_plus;
				outputCurve->minFrames.push_back(new_frame);
				log << "push new frame -- done" << std::endl << std::endl;

			}
			log << "all done!" << std::endl;
			log.close();
		};

	};

	void printSliceOnPng(std::string filename, short* slice, int size[2], double spacing[2]);

	std::vector <std::vector <int> > getVesselContour(short* slice, int size[2], double spacing[2], double A, double C);
	std::vector <int> getOneSideContour(short* slice, int size[2], double spacing[2], double A, double C, std::string mode);

	class AGBImage3D {
	public:
		AGBImage3D(short* _data, unsigned long long* _dims, double* _spacing, double* _origin, double* _imageToSpace, double* _spaceToImage) {
			for (int i = 0; i < 3; i++) {
				dims[i] = _dims[i];
				origin[i] = _origin[i];
				spacing[i] = _spacing[i];
			}
			n = _dims[0] * _dims[1] * _dims[2];
			data = new short[n];
			for (size_t i = 0; i < n; i++)
				data[i] = _data[i];
			for (int i = 0; i < 16; i++) {
				imageToSpace[i] = _imageToSpace[i];
				spaceToImage[i] = _spaceToImage[i];
			}
		};
		~AGBImage3D() {
			if (data != nullptr)
				delete[] data;
		};
	public:
		unsigned long long getIndex(int x, int y, int z) {
			return ((unsigned long long)x) + dims[0] * (((unsigned long long) y) + dims[1] * ((unsigned long long)z));
		};
		short getData(int x, int y, int z) {
			return data[getIndex(x, y, z)];
		};

	public:
		unsigned long long n;
		short* data;
		unsigned long long dims[3];
		double spacing[3];
		double origin[3];
		double imageToSpace[16];
		double spaceToImage[16];
	};

	class AGBImage2D {
	public:
		AGBImage2D() {};
		//void setComissuralPoints(vector<double> p1, vector<double>p2, vector<double>p3){};

		void getSliceThroughComissuralPoints(AGBImage3D& cube,
											 double p1[3], double p2[3], double p3[3],
											 int halfsize[2], double _spacing[2]) {
			for (int i = 0; i < 3; i++) {
				globalComissuralPoints[0][i] = p1[i];
				globalComissuralPoints[1][i] = p2[i];
				globalComissuralPoints[2][i] = p3[i];
			}
			double midPoint[3];
			for (int i = 0; i < 3; i++)
				midPoint[i] = (p1[i] + p2[i] + p3[i]) / 3;
			double normal[3];

			Ox[0] = p2[0] - p1[0];
			Ox[1] = p2[1] - p1[1];
			Ox[2] = p2[2] - p1[2];
			double v13[3] = { p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2] };

			Utils::normalize(Ox);
			Utils::normalize(v13);

			for (int i = 0; i < 3; i++)
				origin[i] = midPoint[i];

			Utils::vecProd(Ox, v13, normal);
			Utils::normalize(normal);
			Utils::vecProd(normal, Ox, Oy);

			spacing[0] = _spacing[0];
			spacing[1] = _spacing[1];
			getComissuralLocalCoords();

			getAsSlice(cube, halfsize, midPoint, Ox, Oy, spacing);
		};

		void getComissuralLocalCoords() {
			double OxSpaced[2] = { Ox[0] * spacing[0], Ox[1] * spacing[1] };
			double OySpaced[2] = { Oy[0] * spacing[0], Oy[1] * spacing[1] };
			double det2Oxy = OxSpaced[0] * OySpaced[1] - OxSpaced[1] * OySpaced[0];

			for (int i = 0; i < 3; i++) {
				localComissuralPoints[i][0] =
					((globalComissuralPoints[i][0] - origin[0]) * OySpaced[1] - (globalComissuralPoints[i][1] - origin[1]) * OySpaced[0]) / det2Oxy;
				localComissuralPoints[i][1] =
					(OxSpaced[0] * (globalComissuralPoints[i][1] - origin[1]) - OxSpaced[1] * (globalComissuralPoints[i][0] - origin[0])) / det2Oxy;
			};
			comissuralPointsSet = true;

			std::ofstream o("cross-sections\\comissural_points.txt");

			Utils::Print3DtoLog(Ox, "Ox", &o);
			Utils::Print3DtoLog(Oy, "Oy", &o);
			for (int i = 0; i < 3; i++) {
				Utils::Print3DtoLog(globalComissuralPoints[i], " global point", &o);
				o << i << " local point " << localComissuralPoints[i][0] << " " << localComissuralPoints[i][1] << std::endl;
				o << std::endl;
			}
			o.close();
		};

		void getAsSlice(AGBImage3D& cube,
						const int halfSize[2],
						double _origin[3],
						double _Ox[3], double _Oy[3],
						double _spacing[2]) {
			//std::ofstream o("cross-sections\\getAsSlice_log.txt");
			dim[0] = 1 + 2 * halfSize[0];
			dim[1] = 1 + 2 * halfSize[1];
			n = dim[0] * dim[1];

			for (int i = 0; i < 3; i++) {
				Ox[i] = _Ox[i];
				Oy[i] = _Oy[i];
				origin[i] = _origin[i];
			}
			for (int i = 0; i < 2; i++)
				spacing[i] = _spacing[i];

			//Utils::Print3DtoLog(Ox, "Ox", &o);
			//Utils::Print3DtoLog(Oy, "Oy", &o);
			//Utils::Print3DtoLog(origin, "origin", &o);

			if (data != nullptr)
				delete[] data;
			data = new short[n];
			if (mask != nullptr)
				delete[] mask;
			mask = new short[n];
			double coord[3], temp_coord[3];
			for (int x = -halfSize[0]; x <= halfSize[0]; x++) {
				// temp_coord in global space along oX axis
				temp_coord[0] = origin[0] + Ox[0] * (0. + x) * spacing[0];
				temp_coord[1] = origin[1] + Ox[1] * (0. + x) * spacing[0];
				temp_coord[2] = origin[2] + Ox[2] * (0. + x) * spacing[0];

				for (int y = -halfSize[1]; y <= halfSize[1]; y++) {
					// coord in image space 
					coord[0] = (temp_coord[0] + Oy[0] * (0. + y) * spacing[1]) / cube.spacing[0];
					coord[1] = (temp_coord[1] + Oy[1] * (0. + y) * spacing[1]) / cube.spacing[1];
					coord[2] = (temp_coord[2] + Oy[2] * (0. + y) * spacing[1]) / cube.spacing[2];
					//o << "\n\n";
					//Utils::Print3DtoLog(temp_coord, "temp_coord", &o);

					//o << x << " " << y << " coord = " << coord[0] << " " << coord[1] << " " << coord[2] << std::endl;
					//o << "ind :" << x + halfSize[0] + dim[0] * (y + halfSize[1]) << " < " << dim[0]* dim[1] << std::endl ;
					if (coord[0] < 0 || coord[1] < 0 || coord[2] < 0 ||
						coord[0] >= cube.dims[0] || coord[1] >= cube.dims[1] || coord[2] >= cube.dims[2]) {
						data[x + halfSize[0] + dim[0] * (halfSize[1] + y)] = -2048; // out of the image cube
						//o << "out of box" << std::endl;
						continue;
					} else {
						// case inside of the image
						//o << "get image ind:" << std::endl;

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
						/*
						o << "base voxel = [" << base_voxel[0] << ", " << base_voxel[1] << ", " << base_voxel[2] << std::endl;
						Utils::Print3DtoLog(weights, "weigths", &o);
						o << "dir = [" << dir[0] << ", " << dir[1] << ", " << dir[2] << std::endl;

						o << "indices: " <<
							cube.getIndex(base_voxel[0], base_voxel[1], base_voxel[2]) << " " <<
							cube.getIndex(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2]) << " " <<
							cube.getIndex(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2]) << " " <<
							cube.getIndex(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2]) << " " <<
							cube.getIndex(base_voxel[0], base_voxel[1], base_voxel[2] + dir[2]) << " " <<
							cube.getIndex(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2] + dir[2]) << " " <<
							cube.getIndex(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2]) << " " <<
							cube.getIndex(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2]) << std::endl;

						o << "neighbours: \n" <<
							base_voxel[0] << ", " << base_voxel[1] << ", " << base_voxel[2] << "\n " <<
							base_voxel[0] + dir[0] << ", " << base_voxel[1] << ", " << base_voxel[2] << "\n " <<
							base_voxel[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] << "\n " <<
							base_voxel[0] + dir[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] << "\n " <<
							base_voxel[0] << ", " << base_voxel[1] << ", " << base_voxel[2] + dir[2] << " " <<
							base_voxel[0] + dir[0] << ", " << base_voxel[1] << ", " << base_voxel[2] + dir[2] << "\n " <<
							base_voxel[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] + dir[2] << "\n " <<
							base_voxel[0] + dir[0] << ", " << base_voxel[1] + dir[1] << ", " << base_voxel[2] + dir[2] << std::endl << std::endl;
						*/

						short x000 = cube.getData(base_voxel[0], base_voxel[1], base_voxel[2]);
						short x001 = cube.getData(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2]);
						short x010 = cube.getData(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2]);
						short x011 = cube.getData(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2]);
						short x100 = cube.getData(base_voxel[0], base_voxel[1], base_voxel[2] + dir[2]);
						short x101 = cube.getData(base_voxel[0] + dir[0], base_voxel[1], base_voxel[2] + dir[2]);
						short x110 = cube.getData(base_voxel[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2]);
						short x111 = cube.getData(base_voxel[0] + dir[0], base_voxel[1] + dir[1], base_voxel[2] + dir[2]);

						//o << "intensities:\n";
						//o << x000 << " " << x001 << " " << x010 << " " << x011 << "\n";
						//o << x100 << " " << x101 << " " << x110 << " " << x111 << "\n";


						double res =
							x000 * (1. - weights[0]) * (1. - weights[1]) * (1. - weights[2]) +
							x001 * weights[0] * (1. - weights[1]) * (1. - weights[2]) +
							x010 * (1. - weights[0]) * weights[1] * (1. - weights[2]) +
							x011 * weights[0] * weights[1] * (1. - weights[2]) +
							x100 * (1. - weights[0]) * (1. - weights[1]) * weights[2] +
							x101 * weights[0] * (1. - weights[1]) * weights[2] +
							x110 * (1. - weights[0]) * weights[1] * weights[2] +
							x111 * weights[0] * weights[1] * weights[2];
						data[x + halfSize[0] + dim[0] * (y + halfSize[1])] = (short)floor(res);
						//mask[x + halfSize[0] + dim[0] * (y + halfSize[1])] = (short)cube();
						//o << "res = " << res << std::endl;
					}
				}
			}

			GetComissuralPaths();
			for (int i = 0; i < 3; i++)
				for (int x = -10; x < 10; x++)
					for (int y = -10; y < 10; y++)
						if (x * x + y * y < 25)
							data[((int)floor(localComissuralPoints[i][0])) + x + halfSize[0]
							+ dim[0] * ((int)(floor(localComissuralPoints[i][1])) + y + halfSize[1])] = -1000;


			for (int x = -10; x < 10; x++)
				for (int y = -10; y < 10; y++)
					if (x * x + y * y < 25)
						data[((int)floor(localMidPoint[0])) + x + dim[0] / 2
						+ dim[0] * ((int)(floor(localMidPoint[1])) + y + dim[1] / 2)] = -1000;

			/*
			for (int t = 0; t < 180; t++) {
				double x = localMidPoint[0] + cos(double(t)) * approxAortaSliceRadius / spacing[0];
				double y = localMidPoint[1] + sin(double(t)) * approxAortaSliceRadius / spacing[1];
				data[((int)floor(x)) + dim[0] / 2
					+ dim[0] * ((int)(floor(y)) + dim[1] / 2)] = -1000;
			}
			*/
			for (int i = 0; i < 3; i++) {
				//o << "PATH " << i << " of " << comissuralPaths[i].size() << std::endl;
				for (auto it = comissuralPaths[i].begin(); it != comissuralPaths[i].end(); it++) {
					int x = floor((*it)[0]);
					int y = floor((*it)[1]);
					//o << "    x y =" << x << " " << y << std::endl;
					data[x + dim[0] / 2
						+ dim[0] * (y + dim[1] / 2)] = -500 * i;
					//o << "     data = " << data[x + dim[0] / 2
						//+ dim[0] * (y + dim[1] / 2)] << std::endl;

				}
			}
			//o.close();
		};


		void GetAortaSliceRadius() {
			double triangleEdges[3];
			for (int i = 0; i < 3; i++)
				triangleEdges[i] = std::sqrt((localComissuralPoints[i][0] - localComissuralPoints[(i + 1) % 3][0]) * (localComissuralPoints[i][0] - localComissuralPoints[(i + 1) % 3][0]) * spacing[0] * spacing[0]
				+ (localComissuralPoints[i][1] - localComissuralPoints[(i + 1) % 3][1]) * (localComissuralPoints[i][1] - localComissuralPoints[(i + 1) % 3][1]) * spacing[1] * spacing[1]);
			double halfP = 0.5 * (triangleEdges[0] + triangleEdges[1] + triangleEdges[2]);

			approxAortaSliceRadius = triangleEdges[0] * triangleEdges[1] * triangleEdges[2] /
				(4.0 * std::sqrt(halfP * (halfP - triangleEdges[0]) *
				(halfP - triangleEdges[1]) * (halfP - triangleEdges[2])));
		}


		void GetComissuralPaths() {
			comissuralPaths.clear();
			GetAortaSliceRadius();

			double m_pi = 3.1415926535;

			localMidPoint[0] = 0;
			localMidPoint[1] = 0;
			for (int i = 0; i < 3; i++) {
				localMidPoint[0] += localComissuralPoints[i][0];
				localMidPoint[1] += localComissuralPoints[i][1];
			}
			localMidPoint[0] /= 3; localMidPoint[1] /= 3;

			std::ofstream o("cross-sections\\comissuralAngles_log.txt");
			for (int i = 0; i < 3; i++) {
				comissuralRadians[i] = Utils::getAngle(localMidPoint, localComissuralPoints[i]);
				o << comissuralRadians[i] * 180.0 / 3.14 << " " << comissuralRadians[i] << std::endl;
			}

			for (int ipair = 0; ipair < 3; ipair++) {
				double firstAngle = comissuralRadians[ipair];
				double lastAngle = comissuralRadians[(ipair + 1) % 3];

				/*o << "\n\n\nfirst angle  = " << firstAngle << std::endl;
				o << "last angle  = " << lastAngle << std::endl;
*/
				if (lastAngle < firstAngle) {
					double tmp = lastAngle;
					lastAngle = firstAngle;
					firstAngle = tmp;
					//o << "swap angles" << std::endl;
				}

				// check which arc is the shortest
				if (lastAngle - firstAngle > firstAngle + 2.0 * m_pi - lastAngle) {
					double tmp = firstAngle + 2.0 * m_pi;
					firstAngle = lastAngle;
					lastAngle = tmp;
					//o << "cnagne arc" << std::endl;
				}

				int sliceHalfSize = 10;
				int angleDim = 25;
				double angleStep = (lastAngle - firstAngle) / (double)(angleDim - 1);
				int slicesSizes[2] = { 2 * sliceHalfSize + 1, angleDim };
				/*o << "angle dim = " << angleDim << std::endl;
				o << "angle step = " << angleStep << std::endl;
*/
				short* slices = new short[slicesSizes[0] * slicesSizes[1]];
				double angle = firstAngle;
				for (int angleNo = 0; angleNo < angleDim; angleNo++, angle += angleStep) {
					//o << angleNo << " angle: " << angle << " in [" << firstAngle + angleStep << ", " << lastAngle << "]" << std::endl;
					for (int i = -sliceHalfSize; i <= sliceHalfSize; i += 1) {
						//o << "\n  slice point " << i << " in [" << -sliceHalfSize << ", " << sliceHalfSize << "]" << std::endl;
						double distance = approxAortaSliceRadius + 0.5 * double(i);
						//o << "  distance = " << distance << std::endl;
						double x = localMidPoint[0] + cos(angle) * distance / spacing[0];
						double y = localMidPoint[1] + sin(angle) * distance / spacing[1];
						//o << "  (x, y)= (" << x << ", " << y << ")" << std::endl;

						//o << i + sliceHalfSize + slicesSizes[0] * angleNo << " < " << slicesSizes[0] * slicesSizes[1] << std::endl;
						slices[i + sliceHalfSize + (2 * sliceHalfSize + 1) * angleNo] = data[(int(floor(x))) + dim[0] / 2 + dim[0] * ((int(floor(y))) + dim[1] / 2)];
						
						// data[(int(floor(x))) + dim[0] / 2 + dim[0] * ((int(floor(y))) + dim[1] / 2)] = -1000;
						// o << (int(floor(x))) + dim[0] / 2 << " " << (int(floor(y))) + dim[1] / 2 << " -> " << data[(int(floor(x))) + dim[0] / 2 + dim[0] * ((int(floor(y))) + dim[1] / 2)] << std::endl;
					}
				}

				//o << "\nstart -- getOneSideContour" << std::endl;
				auto inds = getOneSideContour(slices, slicesSizes, spacing, 1, 50, "b2d");
				//o << "done -- getOneSideContour\n" << std::endl;

				std::vector< std::vector <double> > path;

				angle = firstAngle;
				for (int angleNo = 0; angleNo < angleDim; angleNo++, angle += angleStep) {
					//o << angleNo << " angle: " << angle << " in [" << firstAngle << ", " << lastAngle << "]" << std::endl;
					int i = -sliceHalfSize + inds[angleNo];

					//o << "\n  slice point " << i << " in [" << -sliceHalfSize << ", " << sliceHalfSize << "]" << std::endl;
					double distance = approxAortaSliceRadius + 0.5 * double(i);
					//o << "  distance = " << distance << std::endl;
					double x = localMidPoint[0] + cos(angle) * distance / spacing[0];
					double y = localMidPoint[1] + sin(angle) * distance / spacing[1];

					std::vector <double> pathPnt(2);
					pathPnt[0] = x;
					pathPnt[1] = y;
					//o << "pushing PNT = [" << pathPnt[0] << ", " << pathPnt[1] << "]" << std::endl;
					path.push_back(pathPnt);

					//o << "  (x, y)= (" << x << ", " << y << ")" << std::endl;
					data[(int(floor(x))) + dim[0] / 2 + dim[0] * ((int(floor(y))) + dim[1] / 2)] = -1000;
				}

				double dist = 0;
				for (int angleNo = 1; angleNo < angleDim; angleNo++) {
					auto curr = path[angleNo];
					auto prev = path[angleNo - 1];
					dist += std::sqrt((curr[0] - prev[0]) * (curr[0] - prev[0]) * spacing[0] * spacing[0]
									  + (curr[1] - prev[1]) * (curr[1] - prev[1]) * spacing[1] * spacing[1]);
				}
				o << "\n dist = " << dist;
				comissuralPaths.push_back(path);
				delete[]slices;
			}
			o.close();
		};

		void printOnPng(std::string filename) {
            int tmp_dim[2] = { (int)dim[0],(int)dim[1] };
			printSliceOnPng(filename, data, tmp_dim, spacing);
		};

		~AGBImage2D() {
			if (data != nullptr)
				delete[] data;
			if (mask != nullptr)
				delete[] mask;
		};
	private:
		short* data;
		unsigned long long n;
		unsigned long long dim[2];
		double spacing[2];
		double origin[3];
		double Ox[3];
		double Oy[3];

		// aortal slice for comissural points
		short* mask;
		double approxAortaSliceRadius;
		double comissuralRadians[3];
		double localMidPoint[2];
		bool comissuralPointsSet = false;
		double globalComissuralPoints[3][3];
		double localComissuralPoints[3][2];
		std::vector < std::vector < std::vector <double> > > comissuralPaths;
	};
};

#endif //VTB_UTILS_H
