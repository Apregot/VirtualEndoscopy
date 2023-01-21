#include "stdafx.h"
#include "Headers/hessian2d3d.hpp"

#include <stdlib.h>
using namespace std;

void getGrad3D (short *Image, unsigned long long *dim, double sigma,
                float *Dx, float *Dy, float *Dz)
{
  unsigned long long i;
  unsigned long long n;
  n = dim[0]*dim[1]*dim[2];

  float *BluredImage;
  try {
	  BluredImage = new float[n];
  }
  catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc hessian2d3d.cpp BluredImage");
  }
  if (sigma>0)
    GaussianFiltering3D(Image, BluredImage, dim, sigma, sigma*6);
  else
    for(i=0; i < n; ++i)
      BluredImage[i] = Image[i];

  gradient3 (Dx,BluredImage,dim,'x');
  gradient3 (Dy,BluredImage,dim,'y');
  gradient3 (Dz,BluredImage,dim,'z');
  
//  gradient3omp (Dx,BluredImage,dim,'x');
//  gradient3omp (Dy,BluredImage,dim,'y');
//  gradient3omp (Dz,BluredImage,dim,'z');
  
  delete[] BluredImage;
}

void getHessianElements3D (float *Dx,float *Dy,float *Dz,
                           unsigned long long *dim,
                           unsigned long long x,
                           unsigned long long y,
                           unsigned long long z,
                           double hessian_elements[6])
{
  unsigned long long right_index, left_index;
  double dxx,dxy,dxz,dyy,dyz,dzz;
  if (z==0)
  {
    right_index = x+dim[0]*(y+dim[1]);
    left_index  = x+dim[0]*y;

    dxz = Dx[right_index] - Dx[left_index];
    dyz = Dy[right_index] - Dy[left_index];
    dzz = Dz[right_index] - Dz[left_index];
  }
  else if (z == dim[2]-1)
  {
    right_index = x+dim[0]*(y+dim[1]*z);
    left_index  = x+dim[0]*(y+dim[1]*(z-1));

    dxz = Dx[right_index] - Dx[left_index];
    dyz = Dy[right_index] - Dy[left_index];
    dzz = Dz[right_index] - Dz[left_index];
  }
  else
  {
    right_index = x+dim[0]*(y+dim[1]*(z+1));
    left_index  = x+dim[0]*(y+dim[1]*(z-1));
    dxz = (Dx[right_index] - Dx[left_index]) * 0.5;
    dyz = (Dy[right_index] - Dy[left_index]) * 0.5;
    dzz = (Dz[right_index] - Dz[left_index]) * 0.5;
  }

  if (x==0)
  {
    right_index = 1+dim[0]*(y+dim[1]*z);
    left_index  = dim[0]*(y+dim[1]*z);
    dxx = Dx[right_index] - Dx[left_index];
    dxy = Dy[right_index] - Dy[left_index];
  }
  else if (x== dim[0]-1)
  {
    right_index = x+dim[0]*(y+dim[1]*z);
    left_index  = x-1+dim[0]*(y+dim[1]*z);
    dxx = Dx[right_index] -Dx[left_index];
    dxy = Dy[right_index] -Dy[right_index];
  }
  else
  {
    right_index = x+1+dim[0]*(y+dim[1]*z);
    left_index  = x-1+dim[0]*(y+dim[1]*z);
    dxx = (Dx[right_index] -Dx[left_index]) * 0.5;
    dxy = (Dy[right_index] -Dy[left_index]) * 0.5;
  }
  if (y==0)
    dyy = Dy[x+dim[0]*(1+dim[1]*z)] -Dy[x+dim[0]*dim[1]*z];
  else if (y== dim[1]-1)
    dyy = Dy[x+dim[0]*(y+dim[1]*z)] -Dy[x+dim[0]*((y-1)+dim[1]*z)];
  else
    dyy = (Dy[x+dim[0]*(y+1+dim[1]*z)] -Dy[x+dim[0]*(y-1+dim[1]*z)]) * 0.5;

  hessian_elements[0] = dxx;
  hessian_elements[1] = dyy;
  hessian_elements[2] = dzz;
  hessian_elements[3] = dxy;
  hessian_elements[4] = dxz;
  hessian_elements[5] = dyz;
}

void gradient3 (float *Dirivative, float *I , unsigned long long *dim, char mode)
{
  //unsigned long long i,j,p,step;
  int i,j,p,step;
  unsigned long long k = dim[0];
  unsigned long long l = dim[1];
  unsigned long long m = dim[2];
  unsigned long long n = k*l*m;
  
  for (i=0; i<n; ++i)
    Dirivative[i] = 0;

  if (mode == 'x')
  {
    float *dPointer;
    float *iPointer;
    dPointer = Dirivative;
    iPointer = I;
    for (j=0; j<m*l; ++j,
           dPointer += k,
           iPointer += k)
    {
      dPointer[0] = iPointer[1] - iPointer[0];
      for (i=1; i<k-1; ++i)
        dPointer[i] = 0.5 * (iPointer[i+1] - iPointer[i-1]);
      dPointer[k-1] = iPointer[k-1] - iPointer[k-2];
      }

  }
  else if (mode == 'y')
  {
    float *dPointer;
    float *iPointer;
    dPointer = Dirivative;
    iPointer = I;
    for (j=0; j<m; ++j,
        dPointer += k*l,
        iPointer += k*l)
    {
      for (i=0; i<k; ++i)
      {
        dPointer[i] = iPointer[k+i] - iPointer[i];
        for (p=1; p<l-1; ++p)
        dPointer[p*k+i] = 0.5 * (iPointer[(p+1)*k+i] - iPointer[(p-1)*k+i]);
        dPointer[(l-1)*k+i] = iPointer[(l-1)*k+i] - iPointer[(l-2)*k+i];
      }
    }
  }
  else if (mode == 'z')
  {
    step = k*l;
    float *dPointer;
    float *iPointer;
    dPointer = Dirivative;
    iPointer = I;
    for (j=0; j<k*l; ++j,
           dPointer += 1,
           iPointer += 1)
    {
      dPointer[0] = iPointer[step] - iPointer[0];
      for (i=1; i<m-1; ++i)
        dPointer[i*step] = 0.5 * (iPointer[(i+1)*step] - iPointer[(i-1)*step]);
      dPointer[step*(m-1)] = iPointer[step*(m-1)] - iPointer[step*(m-2)];
    }
  }
}

void gradient3omp (float *Dirivative, float *I , unsigned long long *dim, char mode)
{
  //unsigned long long i,j,p,step;
  int i,j,p,step;
  unsigned long long k = dim[0];
  unsigned long long l = dim[1];
  unsigned long long m = dim[2];
  unsigned long long n = k*l*m;
  
//  for (i=0; i<n; ++i)
//    Dirivative[i] = 0;

  if (mode == 'x') {
    unsigned long long ml=m*l;
#pragma omp parallel shared(Dirivative,I)
    {
#pragma omp for private (i)
      for (j=0; j<ml; ++j) {
        unsigned long long kj=k*j;
        Dirivative[kj] = I[kj+1] - I[kj];
        for (i=1; i<k-1; ++i)
          Dirivative[kj+i] = 0.5 * (I[kj+i+1] - I[kj+i-1]);
        Dirivative[kj+k-1] = I[kj+k-1] - I[kj+k-2];
      }
    }
  } else if (mode == 'y') {
    unsigned long long kl=k*l;
#pragma omp parallel shared(Dirivative,I) private (i)
    {
#pragma omp for 
      for (j=0; j<m; ++j) {
        for (i=0; i<k; ++i) {
          Dirivative[kl*j+i] = I[kl*j+k+i] - I[kl*j+i];
          for (p=1; p<l-1; ++p)
            Dirivative[kl*j + p*k+i] = 0.5 * (I[kl*j+(p+1)*k+i] - I[kl*j+(p-1)*k+i]);
          Dirivative[kl*j+(l-1)*k+i] = I[kl*j+(l-1)*k+i] - I[kl*j+(l-2)*k+i];
        }
      }
    }
  } else if (mode == 'z') {
    step = k*l;
#pragma omp parallel shared(Dirivative,I) private (i)
    {
#pragma omp for 
      for (j=0; j<step; ++j)
      {
        Dirivative[j] = I[j+step] - I[j];
        for (i=1; i<m-1; ++i)
          Dirivative[j+i*step] = 0.5 * (I[j+(i+1)*step] - I[j+(i-1)*step]);
        Dirivative[j+step*(m-1)] = I[j+step*(m-1)] - I[j+step*(m-2)];
      }
    }
  }
}

void getGrad2D (short * Image,
                unsigned long long *dim,
                double sigma,
                float *Dx, float *Dy)
{
  unsigned long long i;
  unsigned long long n;
  n = dim[0]*dim[1];

  float *BluredImage;
  try {
	  BluredImage = new float[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc hessian2d3d.cpp BluredImage");
  }

  if (sigma>0)
    GaussianFiltering2D(Image, BluredImage, dim, sigma, sigma*6);
  else
    for(i=0; i < n; ++i)
      BluredImage[i] = Image[i];
  gradient2 (Dx,BluredImage,dim,'x');
  gradient2 (Dy,BluredImage,dim,'y');
  delete[] BluredImage;
}

void getHessianElements2D (float *Dx,float *Dy,
                           unsigned long long *dim,
                           unsigned long long x,
                           unsigned long long y,
                           double hessian_elements[3])
{
  unsigned long long right_index, left_index;
  double dxx,dxy,dyy;

  if (x==0)
  {
    right_index = 1+dim[0]*y;
    left_index  = dim[0]*y;
    dxx = Dx[right_index] - Dx[left_index];
    dxy = Dy[right_index] - Dy[left_index];
  }
  else if (x== dim[0]-1)
  {
    right_index = x+dim[0]*y;
    left_index  = x-1+dim[0]*y;
    dxx = Dx[right_index] - Dx[left_index];
    dxy = Dy[right_index] - Dy[right_index];
  }
  else
  {
    right_index = x+1+dim[0]*y;
    left_index  = x-1+dim[0]*y;
    dxx = (Dx[right_index] - Dx[left_index]) * 0.5;
    dxy = (Dy[right_index] - Dy[left_index]) * 0.5;
  }
  if (y==0)
    dyy = Dy[x+dim[0]] - Dy[x];
  else if (y== dim[1]-1)
    dyy = Dy[x+dim[0]*y] - Dy[x+dim[0]*(y-1)];
  else
    dyy = (Dy[x+dim[0]*(y+1)] - Dy[x+dim[0]*(y-1)]) * 0.5;

  hessian_elements[0] = dxx;
  hessian_elements[1] = dxy;
  hessian_elements[2] = dyy;
}

void gradient2 (float *Dirivative, float *I , unsigned long long *dim, char mode)
{
  unsigned long long i,j,p;
  unsigned long long n = dim[0]*dim[1];
  
  for (i=0; i<n; ++i)
    Dirivative[i] = 0;

  if (mode == 'x')
  {
    float *dPointer;
    float *iPointer;
    dPointer = Dirivative;
    iPointer = I;
    for (j=0; j<dim[1]; ++j,
          dPointer += dim[0],
          iPointer += dim[0])
    {
      dPointer[0] = iPointer[1] - iPointer[0];
      for (i=1; i<dim[0]-1; ++i)
        dPointer[i] = 0.5 * (iPointer[i+1] - iPointer[i-1]);
      dPointer[dim[0]-1] = iPointer[dim[0]-1] - iPointer[dim[0]-2];
    }

  }
  else if (mode == 'y')
  {
    float *dPointer;
    float *iPointer;
    dPointer = Dirivative;
    iPointer = I;

    for (i=0; i<dim[1]; ++i)
    {
      dPointer[i] = iPointer[dim[0]+i] - iPointer[i];
      for (p=1; p<dim[1]-1; ++p)
        dPointer[p*dim[0]+i] = 0.5 * (iPointer[(p+1)*dim[0]+i]
                                   - iPointer[(p-1)*dim[0]+i]);
      dPointer[(dim[1]-1)*dim[0] + i] = iPointer[(dim[1]-1)*dim[0] + i]
                                      - iPointer[(dim[1]-2)*dim[0] + i];
    }
  }
}
