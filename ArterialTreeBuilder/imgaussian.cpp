#include "stdafx.h"
#include "Headers/imgaussian.hpp"

#ifndef min
#define min(a,b)        ((a) < (b) ? (a): (b))
#endif
#ifndef max
#define max(a,b)        ((a) > (b) ? (a): (b))
#endif
#define clamp(a, b1, b2) min(max(a, b1), b2);


void imfilter1D (short *I, unsigned long long lengthI, float *H, unsigned long long lengthH, float *J)
{
  long long tmp;
  long long offset;
  unsigned long long x, i, index;
  unsigned long long b2, offset2;
  if(lengthI==1)
    J[0]=I[0];
  else
  {
    b2 = lengthI-1;
    offset=(lengthH-1)/2;
    for(x=0; x<min(offset,lengthI); x++)
    {
      J[x]=0;
      offset2=x-offset;
      for(i=0; i<lengthH; i++)
      {
        index=clamp(i+offset2, 0, b2);
        J[x]+=I[index]*H[i];
      }
    }
    tmp = lengthI-offset;
    if (tmp>=0)
      for(x=offset; x<(unsigned long long)(tmp); x++)
      {
        J[x]=0;
        offset2=x-offset;
        for(i=0; i<lengthH; i++)
        {
          index=i+offset2;
          J[x]+=I[index]*H[i];
        }
      }
    
    for(x=max((tmp>0?(unsigned long long)tmp:0),offset); x<lengthI; x++)
    {
      J[x]=0;
      offset2=x-offset;
      for(i=0; i<lengthH; i++)
      {
        index=clamp(i+offset2, 0, b2);
        J[x]+=I[index]*H[i];
      }
    }
  }
}

void imfilter2D(short *I, unsigned long long *sizeI, float *H, unsigned long long lengthH, float *J)
{
  unsigned long long y, x, i, y2;
  short *Irow;
  float *Crow;
  unsigned long long index=0, line=0;
  float *RCache;
  short *nCache;
  unsigned long long hks, offset, offset2;
  RCache = new float[lengthH*sizeI[0]];
  for(i=0; i<lengthH*sizeI[0]; i++)
    RCache[i]=0;

  nCache = new short[lengthH];
  for(i=0; i<lengthH; i++)
    nCache[i]=0;

  hks=((lengthH-1)/2);
  for(y=0; y<min(hks,sizeI[1]); y++)
  {
    Irow=&I[index];
    Crow=&RCache[line*sizeI[0]];
    imfilter1D(Irow, sizeI[0], H, lengthH, Crow);
    index+=sizeI[0];
    if(y!=(sizeI[1]-1))
    {
      line++;
      if(line>(lengthH-1))
        line=0;
    }
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }
  for(y2=y; y2<hks; y2++)
  {
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }

  for(y=hks; y<(sizeI[1]-1); y++)
  {
    Irow=&I[index];
    Crow=&RCache[line*sizeI[0]];
    imfilter1D(Irow, sizeI[0], H, lengthH, Crow);

    offset=(y-hks)*sizeI[0];
    offset2=nCache[0]*sizeI[0];

    for(x=0; x<sizeI[0]; x++)
      J[offset+x]=RCache[offset2+x]*H[0];
    for(i=1; i<lengthH; i++)
    {
      offset2=nCache[i]*sizeI[0];
      for(x=0; x<sizeI[0]; x++)
        J[offset+x]+=RCache[offset2+x]*H[i];
    }
    index+=sizeI[0];

    line++;
    if(line>(lengthH-1))
      line=0;

    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }

  for(y=max(sizeI[1]-1,hks); y<sizeI[1]; y++)
  {
    Irow=&I[index];
    Crow=&RCache[line*sizeI[0]];
    imfilter1D(Irow, sizeI[0], H, lengthH, Crow);

    offset=(y-hks)*sizeI[0];
    offset2=nCache[0]*sizeI[0];

    for(x=0; x<sizeI[0]; x++)
      J[offset+x]=RCache[offset2+x]*H[0];
    for(i=1; i<lengthH; i++)
    {
      offset2=nCache[i]*sizeI[0];
      for(x=0; x<sizeI[0]; x++)
        J[offset+x]+=RCache[offset2+x]*H[i];
    }
    index+=sizeI[0];
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }

  for(y=max(sizeI[1],hks); y<(sizeI[1]+hks); y++)
  {
    offset=(y-hks)*sizeI[0];
    offset2=nCache[0]*sizeI[0];

    for(x=0; x<sizeI[0]; x++)
      J[offset+x]=RCache[offset2+x]*H[0];
    for(i=1; i<lengthH; i++)
    {
      offset2=nCache[i]*sizeI[0];
      for(x=0; x<sizeI[0]; x++)
        J[offset+x]+=RCache[offset2+x]*H[i];
    }
    index+=sizeI[0];
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }

  delete[] nCache;
  delete[] RCache;
}

void imfilter3D(short *I, unsigned long long * sizeI, float *H, unsigned long long lengthH, float *J)
{
	unsigned long long z, j, i, z2;
	short *Islice;
	float *Cslice;
	unsigned long long index=0, line=0;
	float *SCache;
	short *nCache;
	unsigned long long hks, offset, offset2;
	unsigned long long nslice;
	nslice=sizeI[0]*sizeI[1];

	SCache = new float[lengthH*nslice];
	for(i=0; i<nslice; i++)
		SCache[i]=0;

	nCache = new short[lengthH];
	for(i=0; i<lengthH; i++)
		nCache[i]=0;

	hks=((lengthH-1)/2);
	for(z=0; z<min(hks,sizeI[2]); z++)
	{
		Islice=&I[index];
		Cslice=&SCache[line*nslice];
		imfilter2D(Islice, sizeI, H, lengthH, Cslice);
		index+=nslice;
		if(z!=(sizeI[2]-1))
		{
			line++;
			if(line>(lengthH-1))
				line=0;
		}
		for(i=0; i<(lengthH-1); i++)
			nCache[i]=nCache[i+1];
		nCache[lengthH-1]=line;
	}
	for(z2=z; z2<hks; z2++)
	{
		for(i=0; i<(lengthH-1); i++)
			nCache[i]=nCache[i+1];
		nCache[lengthH-1]=line;
	}
	for(z=hks; z<(sizeI[2]-1); z++)
	{
		Islice=&I[index];
		Cslice=&SCache[line*nslice];
		imfilter2D(Islice, sizeI, H, lengthH, Cslice);

		offset=(z-hks)*nslice;
		offset2=nCache[0]*nslice;

		for(j=0; j<nslice; j++)
			J[offset+j]=SCache[offset2+j]*H[0];
    for(i=1; i<lengthH; i++)
    {
      offset2=nCache[i]*nslice;
      for(j=0; j<nslice; j++)
        J[offset+j]+=SCache[offset2+j]*H[i];
    }
    index+=nslice;
    line++;
    if(line>(lengthH-1))
      line=0;
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }
  for(z=max(sizeI[2]-1,hks); z<sizeI[2]; z++)
  {
    Islice=&I[index];
    Cslice=&SCache[line*nslice];
    imfilter2D(Islice, sizeI, H, lengthH, Cslice);

    offset=(z-hks)*nslice;
    offset2=nCache[0]*nslice;

    for(j=0; j<nslice; j++)
      J[offset+j]=SCache[offset2+j]*H[0];
    for(i=1; i<lengthH; i++)
    {
      offset2=nCache[i]*nslice;
      for(j=0; j<nslice; j++)
        J[offset+j]+=SCache[offset2+j]*H[i];
    }
    index+=nslice;
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }
  for(z=max(sizeI[2],hks); z<(sizeI[2]+hks); z++)
  {
    offset=(z-hks)*nslice;
    offset2=nCache[0]*nslice;

    for(j=0; j<nslice; j++)
      J[offset+j]=SCache[offset2+j]*H[0];
    for(i=1; i<lengthH; i++)
    {
      offset2=nCache[i]*nslice;
      for(j=0; j<nslice; j++)
        J[offset+j]+=SCache[offset2+j]*H[i];
    }
    index+=nslice;
    for(i=0; i<(lengthH-1); i++)
      nCache[i]=nCache[i+1];
    nCache[lengthH-1]=line;
  }

  delete[] nCache;
  delete[] SCache;
}

void GaussianFiltering3D(short *I, float *J, unsigned long long *dimsI, float sigma, float kernel_size)
{
	unsigned long long kernel_length,i;
	float x, *H, totalH=0;

/* Construct the 1D gaussian kernel */
	if(kernel_size<1)
		kernel_size=1;
	kernel_length=(unsigned long long)(2*ceil(kernel_size/2)+1);
	H = new float[kernel_length];
	x=-ceil(kernel_size/2);

	for (i=0; i<kernel_length; i++)
	{
		H[i]=exp(-((x*x)/(2*(sigma*sigma))));
		totalH+=H[i];
		++x;
	}
	for (i=0; i<kernel_length; i++)
		H[i]/=totalH;
	imfilter3D(I, dimsI, H, kernel_length, J);
	delete[] H;
}

void GaussianFiltering2D(short *I, float *J, unsigned long long *dimsI, float sigma, float kernel_size)
{
	unsigned long long kernel_length,i;
	float x, *H, totalH=0;

	if(kernel_size<1)
		kernel_size=1;
	kernel_length=(unsigned long long)(2*ceil(kernel_size/2)+1);
	H = new float[kernel_length];

	x=-ceil(kernel_size/2);
	for (i=0; i<kernel_length; i++)
	{
		H[i]=exp(-((x*x)/(2*(sigma*sigma))));
		totalH+=H[i];
		++x;
	}
	for (i=0; i<kernel_length; i++)
		H[i]/=totalH;

	imfilter2D(I, dimsI, H, kernel_length, J);
	delete[] H;
}

void GaussianFiltering1D(short *I, float *J, unsigned long long lengthI, float sigma, float kernel_size)
{
	unsigned long long kernel_length,i;
	float x, *H, totalH=0;

/* Construct the 1D gaussian kernel */
	if (kernel_size<1)
		kernel_size = 1;
	kernel_length = (unsigned long long)(2 * ceil(kernel_size / 2) + 1);
	H = new float[kernel_length];

	x = -ceil(kernel_size/2);
	for (i=0; i<kernel_length; i++)
	{
		H[i] = exp(-((x * x) / (2 * (sigma * sigma))));
		totalH += H[i];
		++x;
	}
	for (i=0; i<kernel_length; i++)
		H[i] /= totalH;
	imfilter1D(I, lengthI, H, kernel_length, J);
	delete[] H;
}
