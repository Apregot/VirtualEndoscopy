#ifndef HESSIAN2D3D_HPP
#define HESSIAN2D3D_HPP
#include "../Headers/imgaussian.hpp"

void getGrad3D (short *Image, unsigned long long *dim, double sigma,
				float *Dx, float *Dy, float *Dz);

void gradient3 (float *Dirivative,
				float *I ,
				unsigned long long *dim,
				char mode);

void gradient3omp (float *Dirivative, float *I , unsigned long long *dim, char mode);

void getHessianElements3D (float *Dx, float *Dy, float *Dz,
							unsigned long long *dim,
							unsigned long long x,
							unsigned long long y,
							unsigned long long z,
							double hessian_elements[6]);

void getGrad2D (short * Image,
				unsigned long long *dim,
				double sigma,
				float *Dx, float *Dy);

void gradient2 (float *Dirivative,
				float *I ,
				unsigned long long *dim,
				char mode);
void getHessianElements2D (float *Dx, float *Dy,
							unsigned long long *dim,
							unsigned long long x,
							unsigned long long y,
							double hessian_elements[3]);

#endif /*HESSIAN2D3D_HPP*/