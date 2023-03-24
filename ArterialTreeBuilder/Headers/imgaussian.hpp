#ifndef IMGAUSSIAN_HPP
#define IMGAUSSIAN_HPP
void imfilter1D (short *I, unsigned long long lengthI, 
					float *H, unsigned long long lengthH, float *J);
void imfilter2D (short *I, unsigned long long * sizeI, 
					float *H, unsigned long long lengthH, float *J);
void imfilter3D (short *Im, unsigned long long * sizeI, 
					float *H, unsigned long long lengthH, float *J);

void GaussianFiltering3D (short *Im, float *J, 
							unsigned long long *dimsI, float sigma,
							float kernel_size);
void GaussianFiltering2D (short *Im, float *J,
							unsigned long long *dimsI, float sigma,
							float kernel_size);
void GaussianFiltering1D (short *Im, float *J, 
							unsigned long long lengthI, float sigma,
							float kernel_size);
#endif /*IMGAUSSIAN_HPP*/