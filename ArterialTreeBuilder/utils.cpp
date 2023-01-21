#include "stdafx.h"
#include "Headers/utils.h"
#include "Headers/imgaussian.hpp"
#include <vector>
namespace Utils {
	double lengthSqrd(double vec[3]) {
		return vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2];
	}


	double length(double vec[3]) {
		return sqrt(lengthSqrd(vec));
	}


	double length(double a, double b, double c) {
		double vec[3];
		vec[0] = a, vec[1] = b, vec[2] = c;
		return length(vec);
	}


	double normalize(double vec[3]) {
		double len = length(vec);
		if (fabs(len) > 1e-10)
			for (int i = 0; i < 3; i++)
				vec[i] /= len;
		return len;
	}

	double normalizeV(std::vector<double> vec) {
		assert(vec.size() > 2);
		double vecD[3];
		for (int i = 0; i < 3; i++)
			vecD[i] = vec[i];
		double len = length(vecD);
		assert(fabs(len) > 1e-10);
		for (int i = 0; i < 3; i++)
			vec[i] /= len;
		return len;
	}

	double dotProdV(std::vector<double> vecA, std::vector<double> vecB) {
		assert(vecA.size() > 2);
		assert(vecB.size() > 2);
		return vecA[0] * vecB[0] + vecA[1] * vecB[1] + vecA[2] * vecB[2];
	}

	void crossProdV(std::vector<double> vecA, std::vector<double> vecB, double res[3]) {
		assert(vecA.size() > 2);
		assert(vecB.size() > 2);

		for (int i = 0; i < 3; i++)
			res[i] = vecA[(i + 1) % 3] * vecB[(i + 2) % 3] - vecA[(i + 2) % 3] * vecB[(i + 1) % 3];
		return;
	}

	double dotProd(double vecA[3], double vecB[3]) {
		return vecA[0] * vecB[0] + vecA[1] * vecB[1] + vecA[2] * vecB[2];
	}


	void crossProd(double vecA[3], double vecB[3], double vecRes[3]) {
		for (int i = 0; i < 3; i++)
			vecRes[i] = vecA[(i + 1) % 3] * vecB[(i + 2) % 3] - vecA[(i + 2) % 3] * vecB[(i + 1) % 3];
		return;
	}
	void vecProd(double vecA[3], double vecB[3], double vecProd[3]) {

		vecProd[0] = vecA[1] * vecB[2] - vecA[2] * vecB[1];
		vecProd[1] = vecA[2] * vecB[0] - vecA[0] * vecB[2];
		vecProd[2] = vecA[0] * vecB[1] - vecA[1] * vecB[0];

	}

	double pointDist(std::vector<double> A, std::vector<double> B) {
		return std::sqrt((A[0] - B[0]) * (A[0] - B[0])
					   + (A[1] - B[1]) * (A[1] - B[1])
					   + (A[2] - B[2]) * (A[2] - B[2]));
	}

	double pointDistD(double A[3], double B[3]) {
		return std::sqrt((A[0] - B[0]) * (A[0] - B[0])
					   + (A[1] - B[1]) * (A[1] - B[1])
					   + (A[2] - B[2]) * (A[2] - B[2]));
	}

	double pointDistSqrd(std::vector<double> A, std::vector<double> B) {
		return (A[0] - B[0]) * (A[0] - B[0])
			+ (A[1] - B[1]) * (A[1] - B[1])
			+ (A[2] - B[2]) * (A[2] - B[2]);
	}


	void writeMaskOnSTL(bool* mask, unsigned long long dim[3], double vsize[3], double origin[3], std::string name_prefix) {
		constexpr unsigned int Dimension = 3;

		using PixelType = bool;
		using ImageType = itk::Image<PixelType, Dimension>;
		itk::STLMeshIOFactory::RegisterOneFactory();

		//SETTING IMAGE

		using ImportFilterType = itk::ImportImageFilter <PixelType, Dimension>;
		ImportFilterType::Pointer importFilter = ImportFilterType::New();

		ImportFilterType::IndexType start;
		start.Fill(0);

		ImportFilterType::RegionType region;
		region.SetIndex(start);
		ImportFilterType::SizeType size;
		size[0] = dim[0]; size[1] = dim[1]; size[2] = dim[2];
		region.SetSize(size);

		importFilter->SetRegion(region);
		importFilter->SetSpacing(vsize);
		//TODO set origin
		importFilter->SetOrigin(origin);
		size_t n = dim[0] * dim[1] * dim[2];
		importFilter->SetImportPointer(mask, n, false);

		auto lowerThreshold = static_cast<PixelType>(0.5);
		auto upperThreshold = static_cast<PixelType>(1.5);

		using BinaryThresholdFilterType = itk::BinaryThresholdImageFilter <ImageType, ImageType>;
		BinaryThresholdFilterType::Pointer threshold = BinaryThresholdFilterType::New();
		threshold->SetInput(importFilter->GetOutput());
		threshold->SetLowerThreshold(lowerThreshold);
		threshold->SetUpperThreshold(upperThreshold);
		threshold->SetOutsideValue(0);

		using MeshType = itk::Mesh< double, Dimension>;

		using FilterType = itk::BinaryMask3DMeshSource<ImageType, MeshType >;
		FilterType::Pointer filter = FilterType::New();
		filter->SetInput(threshold->GetOutput());
		filter->SetObjectValue(255);

		using WriterType = itk::MeshFileWriter<MeshType>;
		WriterType::Pointer writer = WriterType::New();
		writer->SetFileName(name_prefix + ".stl");
		writer->SetFileTypeAsASCII();
		writer->SetFileTypeAsBINARY();
		writer->SetInput(filter->GetOutput());
		try {
			writer->Update();
		} catch (itk::ExceptionObject& error) {
			std::cerr << "Error: " << error << std::endl;
			std::ofstream o("log_writeSTL.txt");
			o << "Error: " << error << std::endl;
			o.close();
            throw std::runtime_error("Error while writing stl");
		}
		return;
	};


	void Print3DtoLog(double a[3], std::string prefix, std::ofstream* o) {
		(*o) << prefix << " = [" << a[0] << ", " << a[1] << ", " << a[2] << "]" << std::endl;
	};

	/*
	void Print3ItoLog(int a[3], std::string prefix, std::ofstream* o) {
		(*o) << prefix << " = [" << a[0] << ", " << a[1] << ", " << a[2] << "]" << std::endl;
	};*/

	void PrintVector3DtoLog(std::vector<double> a, std::string prefix, std::ofstream* o) {
		(*o) << prefix << " = [" << a[0] << ", " << a[1] << ", " << a[2] << "]" << std::endl;
	};
	/*
	void PrintVector3ItoLog(std::vector<int> a, std::string prefix, std::ofstream* o) {
		(*o) << prefix << " = [" << a[0] << ", " << a[1] << ", " << a[2] << "]" << std::endl;
	}; */


    void printSliceOnPng(std::string filename, short* slice, int size[2], double spacing[2]) {
		typedef itk::ImportImageFilter< short, 2 > ImportFilterType;
		ImportFilterType::Pointer importFilter = ImportFilterType::New();
		ImportFilterType::SizeType _size;
		_size[0] = size[0]; _size[1] = size[1];

		ImportFilterType::IndexType start;
		start.Fill(0);
		ImportFilterType::RegionType region;
		region.SetIndex(start);
		region.SetSize(_size);
		importFilter->SetRegion(region);

		const itk::SpacePrecisionType origin[2] = { 0.0, 0.0 };
		importFilter->SetOrigin(origin);
		const itk::SpacePrecisionType  _spacing[2] = { 1.0, 1.0 };
		importFilter->SetSpacing(_spacing);
		importFilter->SetImportPointer(slice, size[0] * size[1], false);

		itk::PNGImageIOFactory::RegisterOneFactory();
		using ImageType = itk::Image<short, 2>;
		using UCharImageType = itk::Image<unsigned char, 2>;
		typedef itk::RescaleIntensityImageFilter< ImageType, UCharImageType > RescaleFilterType;
		RescaleFilterType::Pointer rescaleFilter = RescaleFilterType::New();
		rescaleFilter->SetInput(importFilter->GetOutput());
		rescaleFilter->SetOutputMinimum(0);
		rescaleFilter->SetOutputMaximum(255);
		rescaleFilter->Update();

		typedef itk::ImageFileWriter<  UCharImageType  > WriterType;
		WriterType::Pointer writer = WriterType::New();
		writer->SetInput(rescaleFilter->GetOutput());
		writer->SetFileName(filename);
		try {
			writer->Update();
		} catch (itk::ExceptionObject& err) {
			std::ofstream e("logs\\itk_log.txt");
			e << err << std::endl;
			e.close();

            throw std::exception(err);
			//return EXIT_FAILURE;
		}
	}


    std::vector <std::vector <int> > getVesselContour(short* slice, int size[2], double spacing[2], double A, double C) {
		double shift = 14;

		clock_t begClock = clock();
		std::ofstream o("cross-sections//log_getVesselContour.txt");
		o << "start gaussian filtering" << std::endl;
		// 1. get derivatives from left to right
		float* filtered = new float[size[0] * size[1]];
		float* derivative = new float[size[0] * size[1]];
		GaussianFiltering1D(slice, filtered, (unsigned long long)size[0] * (unsigned long long) size[1], 1, 6);
		o << "done -- time" << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << std::endl;

		begClock = clock();
		o << "start derivative" << std::endl;
		for (auto islice = 0; islice < size[1]; islice++) {
			derivative[islice * size[0]] = filtered[1 + islice * size[0]] - filtered[islice * size[0]];

			for (auto j = 1; j < size[0] - 1; j++) {
				derivative[j + size[0] * islice]
					= 0.5 * (filtered[j + 1 + size[0] * islice] - filtered[j - 1 + size[0] * islice]);
			}
			derivative[size[0] - 1 + islice * size[0]] = filtered[size[0] - 1 + islice * size[0]] - filtered[size[0] - 2 + islice * size[0]];
		}
		o << "done -- time" << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << std::endl;

		// 2 dynamic programming
		// maximize benefit function   ( A * B_g - B_d )
		// where
		// B_g = sum |g_ij| + c (sign(g_ij) - 1)
		// B_d = sum | r_ij - r_(i+1)j(i+1)|

		o << " start dynamic programming init" << std::endl;
		begClock = clock();

		double g_ij, r_ij, r_next;
		std::vector <std::vector <double> > benefitLayer(size[1]); // length may vary
		for (auto it = benefitLayer.begin(); it != benefitLayer.end(); it++) {
			it->resize(2 * shift); // first half for left size, second half for the right side
			for (auto iit = it->begin(); iit != it->end(); iit++) {
				(*iit) = -1e+10;
			}
		}

		std::vector <std::vector<int> > maxBenefitCoord(size[1]);
		// max among benefit layer on every step
		// first coord stands for the left contour, second for the right contour
		for (auto it = maxBenefitCoord.begin(); it != maxBenefitCoord.end(); it++) {
			std::vector<int> tmp({ 0,0 });
			(*it) = tmp;
		}

		o << "done -- time" << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << std::endl;

		double sign;

		o << " start dynamic programming layer 0" << std::endl;
		begClock = clock();

		maxBenefitCoord[0][0] = -1;
		maxBenefitCoord[0][1] = -1;


		for (int side = 0; side < 2; side++) {
			double maxVal = -1e+10;

			int mult = (1 - 2 * side);
			// side: 0 for left side, 1 for right side
			for (int j = 0; j < shift; j++) {
				int ind = size[0] / 2 - mult * j;
				g_ij = ((double)mult) * derivative[ind];
				sign = (double)((0 < g_ij) - (0 > g_ij));

				benefitLayer[0][j + shift * side] = A * (fabs(g_ij) + C * (sign - 1.0));
				if (benefitLayer[0][j + shift * side] > maxVal) {
					maxBenefitCoord[0][side] = ind;
					maxVal = benefitLayer[0][j + shift * side];
				}
			}

			// MAIN CYCLE
			for (int islice = 1; islice < size[1]; islice++) {
				maxVal = -1e+10;
				for (int j = 0; j < shift; j++) {
					int ind = size[0] / 2 - mult * j;

					g_ij = ((double)mult) * derivative[ind + size[0] * islice];
					assert(size[0] * size[1] > ind + size[0] * islice);
					sign = (double)((0 < g_ij) - (0 > g_ij));
					for (int j_prev = 0; j_prev < shift; j_prev++) {
						double test_val = benefitLayer[islice - 1][j_prev + side * shift]
							+ A * (fabs(g_ij) + C * (sign - 1.0)) - (double)(abs(j - j_prev));
						if (test_val > benefitLayer[islice][j + side * shift])
							benefitLayer[islice][j + side * shift] = test_val;
					}
					if (benefitLayer[islice][j + shift * side] > maxVal) {
						maxBenefitCoord[islice][side] = size[0] / 2 - mult * j;
						maxVal = benefitLayer[islice][j + shift * side];
					}
				}
			}
		}

		o << "done -- time" << (double)(clock() - begClock) / CLOCKS_PER_SEC << " sec" << std::endl;

		o << " print png" << std::endl;
		double cs_spacing[2] = { 1.0,1.0 };
		Utils::printSliceOnPng("cross-sections\\left_border.png",
								   slice, size, cs_spacing);

		o << "done" << std::endl;

		for (auto it = maxBenefitCoord.begin(); it != maxBenefitCoord.end(); it++) {
			o << (*it)[0] << " " << (*it)[1] << std::endl;
		}

		delete[] filtered;
		delete[] derivative;
		o.close();
		return maxBenefitCoord;
	}


    std::vector <int> getOneSideContour(short* slice, int size[2], double spacing[2], double A, double C, std::string mode) {
		int side = 1;
		if (mode == "d2b") // from surrounding tissues to vessel
			side = 0;
		else if (mode == "b2d") // from vessel to surrounding tissue
			side = 1;

		std::ofstream o("cross-sections//log_getOneSideContour.txt");
		o << "mode = " << mode << std::endl;
		o << "start gaussian filtering" << std::endl;
		// 1. get derivatives from left to right
		float* filtered = new float[size[0] * size[1]];
		float* derivative = new float[size[0] * size[1]];
		GaussianFiltering1D(slice, filtered, (unsigned long long)size[0] * (unsigned long long) size[1], 1, 6);

		o << "start derivative" << std::endl;
		for (auto islice = 0; islice < size[1]; islice++) {
			derivative[islice * size[0]] = filtered[1 + islice * size[0]] - filtered[islice * size[0]];

			for (auto j = 1; j < size[0] - 1; j++) {
				derivative[j + size[0] * islice]
					= 0.5 * (filtered[j + 1 + size[0] * islice] - filtered[j - 1 + size[0] * islice]);
			}
			derivative[size[0] - 1 + islice * size[0]] = filtered[size[0] - 1 + islice * size[0]] - filtered[size[0] - 2 + islice * size[0]];
		}

		// 2 dynamic programming
		// maximize benefit function   ( A * B_g - B_d )
		// where
		// B_g = sum |g_ij| + c (sign(g_ij) - 1)
		// B_d = sum | r_ij - r_(i+1)j(i+1)|

		o << " start dynamic programming init" << std::endl;

		double g_ij, r_ij, r_next;
		std::vector <std::vector <double> > benefitLayer(size[1]); // length may vary
		for (auto it = benefitLayer.begin(); it != benefitLayer.end(); it++) {
			it->resize(size[0]); // first half for left size, second half for the right side
			for (auto iit = it->begin(); iit != it->end(); iit++) {
				(*iit) = -1e+10;
			}
		}

		std::vector <int > maxBenefitCoord(size[1]);
		// max among benefit layer on every step
		// first coord stands for the left contour, second for the right contour
		for (auto it = maxBenefitCoord.begin(); it != maxBenefitCoord.end(); it++) {
			(*it) = 0;
		}

		double sign;

		o << " start dynamic programming layer 0" << std::endl;

		maxBenefitCoord[0] = -1;

		double maxVal = -1e+10;

		int mult = (1 - 2 * side);
		// side: 0 for left side, 1 for right side
		for (int j = 0; j < size[0]; j++) {
			int ind = j;
			g_ij = ((double)mult) * derivative[ind];
			sign = (double)((0 < g_ij) - (0 > g_ij));

			benefitLayer[0][j] = A * (fabs(g_ij) + C * (sign - 1.0));
			if (benefitLayer[0][j] > maxVal) {
				maxBenefitCoord[0] = ind;
				maxVal = benefitLayer[0][j];
			}
		}

		// MAIN CYCLE
		o << "\n\n\n===================MAIN CYCLE=====================\n\n\n";
		for (int islice = 1; islice < size[1]; islice++) {
			o << "slice no " << islice << " of " <<size[1] << std::endl;
			maxVal = -1e+10;
			for (int j = 0; j < size[0]; j++) {
				o << "  point no " << j << " of " << size[0] << std::endl;
				g_ij = ((double)mult) * derivative[j + size[0] * islice];
				assert(size[0] * size[1] > ind + size[0] * islice);
				sign = (double)((0 < g_ij) - (0 > g_ij));
				for (int j_prev = 0; j_prev < size[0]; j_prev++) {
					double test_val = benefitLayer[islice - 1][j_prev]
						+ A * (fabs(g_ij) + C * (sign - 1.0)) - (double)(abs(j - j_prev));
					if (test_val > benefitLayer[islice][j])
						benefitLayer[islice][j] = test_val;
				}
				if (benefitLayer[islice][j] > maxVal) {
					maxBenefitCoord[islice] = j;
					maxVal = benefitLayer[islice][j];
				}
			}
		}

		o << "done" << std::endl;

		for (auto it = maxBenefitCoord.begin(); it != maxBenefitCoord.end(); it++) {
			o << (*it) << std::endl;
		}

		delete[] filtered;
		delete[] derivative;
		o.close();
		return maxBenefitCoord;
	}


	double getAngle(double origin[2], double point[2]) {
		double direction[2]{ point[0] - origin[0], point[1] - origin[1] };
		assert(direction[0] * direction[0] + direction[1] * direction[1] > 1e-8);
		//double len = std::sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
		//double signX = (direction[0] > 0) - (direction[0] < 0);
		//double signY = (direction[1] > 0) - (direction[1] < 0);

		return std::atan2(direction[1], direction[0]);
	};


};


