#include "stdafx.h"
#include "Headers/hessian_filters.hpp"
#include "Headers/eigen.hpp"
#include "Headers/hessian2d3d.hpp"

#include <stdlib.h>
#include <omp.h>
//#include <amp.h>             // заголовочный файл C++ AMP
//using namespace concurrency; // так меньше набирать кода :)
#include "tracer.h"
void FFRService_update_progres(float relativeProgress, const wchar_t* status);  // forward declaration

/*==========================================*/
/*  Parameters:                             */
/*  Image       -- data array               */
/*  dims        -- size of data array       */
/*  sigmasInfo  -- [minSigma,maxSigma,step] */
/*  Falpha }                                */
/*  Fbeta  }    -- Frangi parameters        */
/*  Fc     }                                */
/*==========================================*/

void FrangiFilter3d(double* Vesselness, bool firstUse,
						short* Image, unsigned long long* dims,
						double* sigmasInfo,
						double Falpha, double Fbeta, double Fc,
						bool mod) {
	//unsigned long long x, y ,z;
	int x, y, z;
	//clock_t begClock, endClock;
	double sigma;
	float* Dx, * Dy, * Dz;
	Dx = 0; Dy = 0; Dz = 0;
	unsigned long long n = dims[0] * dims[1] * dims[2];

	double HE[6];
	double EigVals[3];
	double EigVectors[3][3];

	double lambda1, lambda2, lambda3;
	double Ra, Rb;
	double S, A, B, C;
	double expRa, expRb, expS;
	double voxel_data;
	//  double maxFilterValue;
	//  double rescaler;

	if (firstUse)
		for (x = 0; x < n; ++x)
			Vesselness[x] = 0;

	try {
		Dx = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dx");
	}

	try {
		Dy = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dy");
	}

	try {
		Dz = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dz");
	}

	A = 2 * Falpha * Falpha;
	B = 2 * Fbeta * Fbeta;
	C = 2 * Fc * Fc;

	std::ofstream os;
	os.open("log_frangi.txt");

	// Estimate total number of Frangi passes
	int numPasses = 1 + std::round((sigmasInfo[1]-sigmasInfo[0])/sigmasInfo[2]);
	int pass = 0; // Current pass number (from 0 to numPasses-1)
	// All passes should cover progress range from 0.2 to 0.95
	float passValue = 0.75/numPasses; // Progress value for one pass
	// Each pass runs getGrad3D (20%) and OpenMP loop (80%)
	float sliceValue = 0.8*passValue*omp_get_max_threads()/dims[2]; // Progress value for one slice
	for (sigma = sigmasInfo[0];
		sigma <= sigmasInfo[1];
		sigma += sigmasInfo[2], ++pass) {
		// Prepare the running title of the progress [FrangiFilter (pass i/N)]
		const std::wstring progress_title = L"FrangiFilter (pass "+std::to_wstring(pass+1)+L"/"+std::to_wstring(numPasses)+L")";
		const wchar_t* title = progress_title.c_str();
		os << "sigma = " << sigma << ", ";
		// Start of the pass
		FFRService_update_progres(0.2 + passValue*pass, title);
		getGrad3D(Image, dims, sigma, Dx, Dy, Dz);

		//unsigned long long vesselness_index = 0;
		clock_t begClock = clock();
		// Add 20% of the passValue for getGrad3D
		float tt=0.2 + passValue*(pass+0.2) - sliceValue;
		//omp_set_num_threads(1);
		int numThreads = 0;

#pragma omp parallel for shared(Dx,Dy,Dz,Vesselness) private(y,x, voxel_data, Ra,Rb,S, expRa, expRb, expS, lambda1,lambda2,lambda3, EigVals,EigVectors,HE)
		for (z = 0; z < dims[2]; ++z) {
			// Update progress only with rank=0 in order to avoid possible race condition
			if(omp_get_thread_num()==0)
				FFRService_update_progres(tt+=sliceValue, title);
			if(omp_get_num_threads() > numThreads) numThreads = omp_get_num_threads();

			for (y = 0; y < dims[1]; ++y) {
				for (x = 0; x < dims[0]; ++x) {
					unsigned long long vesselness_index = x + dims[0] * (y + z * dims[1]);
					getHessianElements3D(Dx, Dy, Dz, dims, x, y, z, HE);
					if (sigma > 0)
						for (int i = 0; i < 6; ++i)
							HE[i] *= sigma * sigma;
					getHessianDecomposition3D(EigVals, EigVectors, HE);

					if (!mod) {
						if (EigVals[1] > 0 || EigVals[2] > 0) {
							Vesselness[vesselness_index] = 0;
							//++vesselness_index;
							continue;
						}
					} else {
						if (EigVals[1] < 0 || EigVals[2] < 0) {
							Vesselness[vesselness_index] = 0;
							//++vesselness_index;
							continue;
						}
					}
					lambda1 = fabs(EigVals[0]);
					lambda2 = fabs(EigVals[1]);
					lambda3 = fabs(EigVals[2]);

					Ra = lambda2 / lambda3;
					Rb = lambda1 / sqrt(lambda2 * lambda3);

					S = sqrt(lambda1 * lambda1 + lambda2 * lambda2 + lambda3 * lambda3);

					expRa = (1 - exp(-(Ra * Ra / A)));
					expRb = exp(-(Rb * Rb / B));
					expS = (1 - exp(-(S * S) / C));

					voxel_data = expRa * expRb * expS;

                    if (isnan(voxel_data))
						voxel_data = 0;

					if (Vesselness[vesselness_index] < voxel_data)
						Vesselness[vesselness_index] = voxel_data;
					//++vesselness_index;
				}
			}
		}
		os << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << " numThreads=" << numThreads<< std::endl;
		// End of the pass
		FFRService_update_progres(0.2 + passValue*(pass+1), title);

		stringstream ss;
		ss << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << "OpenMP numThreads=" << numThreads<< std::endl;
		tracer.log(ss.str());

	}
	os.close();
	delete[] Dx;
	delete[] Dy;
	delete[] Dz;
	/*
	  maxFilterValue=0;
	  for (unsigned long long i=0; i<n; ++i)
		if (Vesselness[i] > maxFilterValue )
		  maxFilterValue = Vesselness[i];
	  rescaler = 1024. / maxFilterValue;
	  for (unsigned long long i=0; i<n; ++i)
		Vesselness[i] *= rescaler;
	*/
}

void FrangiFilter3d_AMP(double* Vesselness, bool firstUse,
						short* Image, unsigned long long* dims,
						double* sigmasInfo,
						double Falpha, double Fbeta, double Fc,
						bool mod) {
	//unsigned long long x, y ,z;
	int x, y, z;
	//clock_t begClock, endClock;
	double sigma;
	float* Dx, * Dy, * Dz;
	Dx = 0; Dy = 0; Dz = 0;
	unsigned long long n = dims[0] * dims[1] * dims[2];

	double HE[6];
	double EigVals[3];
	double EigVectors[3][3];

	double lambda1, lambda2, lambda3;
	double Ra, Rb;
	double S, A, B, C;
	double expRa, expRb, expS;
	double voxel_data;
	//  double maxFilterValue;
	//  double rescaler;

	if (firstUse)
		for (x = 0; x < n; ++x)
			Vesselness[x] = 0;

	try {
		Dx = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dx");
	}

	try {
		Dy = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dy");
	}

	try {
		Dz = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dz");
	}

	A = 2 * Falpha * Falpha;
	B = 2 * Fbeta * Fbeta;
	C = 2 * Fc * Fc;

	std::ofstream os;
	os.open("log_frangi.txt");
	for (sigma = sigmasInfo[0];
		sigma <= sigmasInfo[1];
		sigma += sigmasInfo[2]) {
		os << "sigma = " << sigma << ", ";
		getGrad3D(Image, dims, sigma, Dx, Dy, Dz);

		//unsigned long long vesselness_index = 0;
		clock_t begClock = clock();
#pragma omp parallel for shared(Dx,Dy,Dz,Vesselness) private(y,x, voxel_data, Ra,Rb,S, expRa, expRb, expS, lambda1,lambda2,lambda3, EigVals,EigVectors,HE)
		for (z = 0; z < dims[2]; ++z) {
			for (y = 0; y < dims[1]; ++y) {
				for (x = 0; x < dims[0]; ++x) {
					unsigned long long vesselness_index = x + dims[0] * (y + z * dims[1]);
					getHessianElements3D(Dx, Dy, Dz, dims, x, y, z, HE);
					if (sigma > 0)
						for (int i = 0; i < 6; ++i)
							HE[i] *= sigma * sigma;
					getHessianDecomposition3D(EigVals, EigVectors, HE);

					if (!mod) {
						if (EigVals[1] > 0 || EigVals[2] > 0) {
							Vesselness[vesselness_index] = 0;
							continue;
						}
					} else {
						if (EigVals[1] < 0 || EigVals[2] < 0) {
							Vesselness[vesselness_index] = 0;
							continue;
						}
					}
					lambda1 = fabs(EigVals[0]);
					lambda2 = fabs(EigVals[1]);
					lambda3 = fabs(EigVals[2]);

					Ra = lambda2 / lambda3;
					Rb = lambda1 / sqrt(lambda2 * lambda3);

					S = sqrt(lambda1 * lambda1 + lambda2 * lambda2 + lambda3 * lambda3);

					expRa = (1 - exp(-(Ra * Ra / A)));
					expRb = exp(-(Rb * Rb / B));
					expS = (1 - exp(-(S * S) / C));

					voxel_data = expRa * expRb * expS;

                    if (isnan(voxel_data))
						voxel_data = 0;

					if (Vesselness[vesselness_index] < voxel_data)
						Vesselness[vesselness_index] = voxel_data;
				}
			}
		}
		os << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << std::endl;
	}
	os.close();
	delete[] Dx;
	delete[] Dy;
	delete[] Dz;
}



double* FrangiFilter3dReturnOptimalScales
(short* Image, unsigned long long* dims,
double* sigmasInfo,
bool returnOptimalScales, double* optimalScales,
double Falpha, double Fbeta, double Fc) {
	unsigned long long x, y, z;
	//clock_t begClock, endClock;
	double* Output;
	double sigma;
	float* Dx, * Dy, * Dz;
	Dx = 0; Dy = 0; Dz = 0;
	unsigned long long n = dims[0] * dims[1] * dims[2];

	double HE[6];
	double EigVals[3];
	double EigVectors[3][3];

	double lambda1, lambda2, lambda3;
	double Ra, Rb;
	double S, A, B, C;
	double expRa, expRb, expS;
	double voxel_data;
	double maxFilterValue;
	double rescaler;

	try {
		Output = new double[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Output");
	}
	try {
		Dx = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dx");
	}

	try {
		Dy = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dy");
	}

	try {
		Dz = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dz");
	}

	for (x = 0; x < n; ++x) {
		Dx[x] = 0;
		Dy[x] = 0;
		Dz[x] = 0;
	}

	A = 2 * Falpha * Falpha;
	B = 2 * Fbeta * Fbeta;
	C = 2 * Fc * Fc;

	for (sigma = sigmasInfo[0];
		sigma <= sigmasInfo[1];
		sigma += sigmasInfo[2]) {
		//begClock = clock();
		//std::cout<<"sigma "<<sigma<<std::endl;

		getGrad3D(Image, dims, sigma, Dx, Dy, Dz);

		unsigned long long output_index = -1;
		for (z = 0; z < dims[2]; ++z) {
			for (y = 0; y < dims[1]; ++y)
				for (x = 0; x < dims[0]; ++x) {
					++output_index;
					getHessianElements3D(Dx, Dy, Dz, dims, x, y, z, HE);
					if (sigma > 0)
						for (int i = 0; i < 6; ++i)
							HE[i] *= sigma * sigma;
					getHessianDecomposition3D(EigVals, EigVectors, HE);

					if (EigVals[1] > 0 || EigVals[2] > 0)
						voxel_data = 0;
					else {
						lambda1 = fabs(EigVals[0]);
						lambda2 = fabs(EigVals[1]);
						lambda3 = fabs(EigVals[2]);

						Ra = lambda2 / lambda3;
						Rb = lambda1 / sqrt(lambda2 * lambda3);

						S = sqrt(lambda1 * lambda1 + lambda2 * lambda2 + lambda3 * lambda3);

						expRa = (1 - exp(-(Ra * Ra / A)));
						expRb = exp(-(Rb * Rb / B));
						expS = (1 - exp(-(S * S) / C));

						voxel_data = expRa * expRb * expS;
					}
                    if (isnan(voxel_data))
						voxel_data = 0;

					if (sigma == sigmasInfo[0]) {
						Output[output_index] = voxel_data;
						if (returnOptimalScales)
							optimalScales[output_index] = sigma;
					} else {
						if (Output[output_index] < voxel_data) {
							Output[output_index] = voxel_data;
							if (returnOptimalScales)
								optimalScales[output_index] = sigma;
						}
					}
				}
		}
		//endClock = clock();
		//std::cout << "time = "<<(double)(endClock - begClock)/CLOCKS_PER_SEC
		//         << " sec" <<std::endl;
	}
	delete[] Dx;
	delete[] Dy;
	delete[] Dz;

	maxFilterValue = 0;
	for (unsigned long long i = 0; i < n; ++i)
		if (Output[i] > maxFilterValue)
			maxFilterValue = Output[i];
	rescaler = 1024. / maxFilterValue;
	for (unsigned long long i = 0; i < n; ++i)
		Output[i] *= rescaler;

	return Output;
}

/*==========================================*/
/*  Parameters:                             */
/*  Image       -- data array               */
/*  dims        -- size of data array       */
/*  sigmasInfo  -- [minSigma,maxSigma,step] */
/*  Fbeta  }    -- filter parameter         */
/*==========================================*/
double* BifurcationFilter3d(short* Image,
							 unsigned long long* dims,
							 double* sigmasInfo,
							 double beta) {
	unsigned long long x, y, z;
	double* Output;
	double sigma;
	float* Dx, * Dy, * Dz;
	Dx = 0; Dy = 0; Dz = 0;
	unsigned long long n = dims[0] * dims[1] * dims[2];

	double HE[6];
	double EigVals[3];
	double EigVectors[3][3];

	double lambda1, lambda2, lambda3;
	double two_beta2 = beta * beta * 2;
	double S;
	double expS, mul1, mul2;
	double exp_gama_sigma;
	double voxel_data;
	double max_value = 0;

	try {
		Output = new double[2 * n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Output");
	}
	try {
		Dx = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dx");
	}

	try {
		Dy = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dy");
	}

	try {
		Dz = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dz");
	}

	for (x = 0; x < n; ++x) {
		Dx[x] = 0;
		Dy[x] = 0;
		Dz[x] = 0;
	}
	for (sigma = sigmasInfo[0];
		sigma <= sigmasInfo[1];
		sigma += sigmasInfo[2]) {
		exp_gama_sigma = exp(0.5 * sigma);
		getGrad3D(Image, dims, sigma, Dx, Dy, Dz);

		unsigned long long output_index = -1;
		for (z = 0; z < dims[2]; ++z) {
			for (y = 0; y < dims[1]; ++y)
				for (x = 0; x < dims[0]; ++x) {
					++output_index;
					getHessianElements3D(Dx, Dy, Dz, dims, x, y, z, HE);
					if (sigma > 0)
						for (int i = 0; i < 6; ++i)
							HE[i] *= sigma * sigma;
					getHessianDecomposition3D(EigVals, EigVectors, HE);

					lambda1 = fabs(EigVals[0]);
					lambda2 = fabs(EigVals[1]);
					lambda3 = fabs(EigVals[2]);

					mul1 = (1. - (lambda3 - lambda2) / (lambda2 + lambda3));
					mul2 = EigVals[0] * 2 / 3 - EigVals[1] - EigVals[2];

					S = sqrt(lambda1 * lambda1 + lambda2 * lambda2 + lambda3 * lambda3);

					expS = (1 - exp(-(S * S) / two_beta2));

					voxel_data = mul1 * mul2 * expS * exp_gama_sigma;

                    if (isnan(voxel_data))
						voxel_data = 0;

					if (voxel_data > max_value)
						max_value = voxel_data;

					if (sigma == sigmasInfo[0]) {
						Output[output_index] = voxel_data;
						Output[n + output_index] = sigma;
					} else if (Output[output_index] < voxel_data) {
						Output[output_index] = voxel_data;
						Output[n + output_index] = sigma;
					}
				}
		}
	}
	delete[] Dx;
	delete[] Dy;
	delete[] Dz;

	double rescaler = 1024. / max_value;
	for (unsigned long long i = 0; i < n; ++i)
		Output[i] *= rescaler;

	return Output;
}

/*==========================================*/
/*  Parameters:                             */
/*  Image       -- data array               */
/*  dims        -- size of data array       */
/*  sigmasInfo  -- [minSigma,maxSigma,step] */
/*  alpha }                                 */
/*  beta  }    -- filter parameters         */
/*==========================================*/

double* CirclenessFilter2d(short* Image,
							 unsigned long long* dims,
							 double optimalScale,
							 double alpha, double beta) {
	unsigned long long x, y;
	double* Output;
	float* Dx, * Dy;
	Dx = 0; Dy = 0;
	unsigned long long n = dims[0] * dims[1];

	double HE[3];
	double EigVals[2];
	double EigVect1[2];
	double EigVect2[2];

	double lambda1, lambda2;
	double Cr, S;
	double expCr, expS;
	double voxel_data;

	double alpha2 = alpha * alpha;
	double two_beta2 = beta * beta * 2;

	try {
		Output = new double[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Output");
	}
	try {
		Dx = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dx");
	}

	try {
		Dy = new float[n];
	} catch (std::bad_alloc) {
        throw std::runtime_error("Bad Alloc hessian_filters.Dy");
	}

	for (x = 0; x < n; ++x) {
		Dx[x] = 0;
		Dy[x] = 0;
	}

	getGrad2D(Image, dims, optimalScale, Dx, Dy);

	unsigned long long output_index = -1;
	for (y = 0; y < dims[1]; ++y)
		for (x = 0; x < dims[0]; ++x) {
			++output_index;
			getHessianElements2D(Dx, Dy, dims, x, y, HE);
			getHessianDecomposition2D(EigVals, HE, EigVect1, EigVect2);

			if (EigVals[0] > 0 || EigVals[1] > 0)
				voxel_data = 0;
			else {
				lambda1 = fabs(EigVals[0]);
				lambda2 = fabs(EigVals[1]);

				Cr = fabs(EigVals[0] + EigVals[1]) / (lambda2 - lambda1);
				S = sqrt(lambda1 * lambda1 + lambda2 * lambda2);

				expCr = (1 - exp(-(Cr * Cr) / alpha2));
				expS = (1 - exp(-(S * S) / two_beta2));

				voxel_data = expCr * expS;

                if (isnan(voxel_data))
					voxel_data = 0;
			}
			Output[output_index] = voxel_data;
		}

	delete[] Dx;
	delete[] Dy;

	double rescaler = 1024;
	for (x = 0; x < n; ++x)
		Output[x] *= rescaler;

	return Output;
}

