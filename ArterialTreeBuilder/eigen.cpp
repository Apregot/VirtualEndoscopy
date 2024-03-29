#include "stdafx.h"
#include "Headers/eigen.hpp"

#ifdef MAX
#undef MAX
#endif
#define MAX(a, b) ((a)>(b)?(a):(b))
#define nn 3

/* Eigen decomposition code for symmetric 3x3 matrices, copied from the public
 * domain Java Matrix library JAMA. */
static double hypot2(double x, double y) { return sqrt(x*x+y*y); }

__inline double absd(double val){ if(val>0){ return val;} else { return -val;} };

/* Symmetric Householder reduction to tridiagonal form. */
static void tred2(double V[nn][nn], double d[nn], double e[nn]) 
{
    
/*  This is derived from the Algol procedures tred2 by */
/*  Bowdler, Martin, Reinsch, and Wilkinson, Handbook for */
/*  Auto. Comp., Vol.ii-Linear Algebra, and the corresponding */
/*  Fortran subroutine in EISPACK. */
    int i, j, k;
    double scale;
    double f, g, h;
    double hh;
    for (j = 0; j < nn; j++)
		d[j] = V[nn-1][j];
    
    /* Householder reduction to tridiagonal form. */
    
    for (i = nn-1; i > 0; i--) 
    {
        /* Scale to avoid under/overflow. */
        scale = 0.0;
        h = 0.0;
        for (k = 0; k < i; k++) 
			scale = scale + fabs(d[k]);
        if (scale == 0.0) 
        {
            e[i] = d[i-1];
            for (j = 0; j < i; j++) 
            { 
				d[j] = V[i-1][j]; 
				V[i][j] = 0.0;  
				V[j][i] = 0.0; 
			}
        } 
        else 
        {
            /* Generate Householder vector. */
            
            for (k = 0; k < i; k++) 
            { 
				d[k] /= scale; 
				h += d[k] * d[k]; 
			}
            f = d[i-1];
            g = sqrt(h);
            if (f > 0) 
				g = -g;
            e[i] = scale * g;
            h = h - f * g;
            d[i-1] = f - g;
            for (j = 0; j < i; j++) 
				e[j] = 0.0;
            
            /* Apply similarity transformation to remaining columns. */
            
            for (j = 0; j < i; j++) 
            {
                f = d[j];
                V[j][i] = f;
                g = e[j] + V[j][j] * f;
                for (k = j+1; k <= i-1; k++) 
                { 
					g += V[k][j] * d[k]; e[k] += V[k][j] * f; 
				}
                e[j] = g;
            }
            f = 0.0;
            for (j = 0; j < i; j++) 
            { 
				e[j] /= h; f += e[j] * d[j]; 
			}
            hh = f / (h + h);
            for (j = 0; j < i; j++) 
            { 
				e[j] -= hh * d[j]; 
			}
            for (j = 0; j < i; j++) 
            {
                f = d[j]; g = e[j];
                for (k = j; k <= i-1; k++) 
					V[k][j] -= (f * e[k] + g * d[k]);
                d[j] = V[i-1][j];
                V[i][j] = 0.0;
            }
        }
        d[i] = h;
    }
    
    /* Accumulate transformations. */
    
    for (i = 0; i < nn-1; i++) 
    {
        V[nn-1][i] = V[i][i];
        V[i][i] = 1.0;
        h = d[i+1];
        if (h != 0.0) 
        {
            for (k = 0; k <= i; k++) 
				d[k] = V[k][i+1] / h;
            for (j = 0; j <= i; j++) 
            {
                g = 0.0;
                for (k = 0; k <= i; k++) 
					g += V[k][i+1] * V[k][j];
                for (k = 0; k <= i; k++) 
					V[k][j] -= g * d[k];
            }
        }
        for (k = 0; k <= i; k++) 
			V[k][i+1] = 0.0;
    }
    for (j = 0; j < nn; j++) 
    {
		d[j] = V[nn-1][j]; 
		V[nn-1][j] = 0.0; 
	}
    V[nn-1][nn-1] = 1.0;
    e[0] = 0.0;
}

/* Symmetric tridiagonal QL algorithm. */
static void tql2(double V[nn][nn], double d[nn], double e[nn]) 
{
/*  This is derived from the Algol procedures tql2, by */
/*  Bowdler, Martin, Reinsch, and Wilkinson, Handbook for */
/*  Auto. Comp., Vol.ii-Linear Algebra, and the corresponding */
/*  Fortran subroutine in EISPACK. */
    
    int i, j, k, l, m;
    double f;
    double tst1;
    double eps;
    int iter;
    double g, p, r;
    double dl1, h, c, c2, c3, el1, s, s2;
    
    for (i = 1; i < nn; i++) 
		e[i-1] = e[i];
    e[nn-1] = 0.0;
    
    f = 0.0;
    tst1 = 0.0;
    eps = pow(2.0, -52.0);
    for (l = 0; l < nn; l++) 
    {
        /* Find small subdiagonal element */
        
        tst1 = MAX(tst1, fabs(d[l]) + fabs(e[l]));
        m = l;
        while (m < nn) 
        {
            if (fabs(e[m]) <= eps*tst1) 
				break;
            m++;
        }
        
        /* If m == l, d[l] is an eigenvalue, */
        /* otherwise, iterate. */
        
        if (m > l) 
        {
            iter = 0;
            do{
                iter = iter + 1;  /* (Could check iteration count here.) */
                /* Compute implicit shift */
                g = d[l];
                p = (d[l+1] - g) / (2.0 * e[l]);
                r = hypot2(p, 1.0);
                if (p < 0) 
					r = -r;
                d[l] = e[l] / (p + r);
                d[l+1] = e[l] * (p + r);
                dl1 = d[l+1];
                h = g - d[l];
                for (i = l+2; i < nn; i++) 
					d[i] -= h;
                f = f + h;
                /* Implicit QL transformation. */
                p = d[m]; c = 1.0; c2 = c; c3 = c;
                el1 = e[l+1]; s = 0.0; s2 = 0.0;
                for (i = m-1; i >= l; i--) 
                {
                    c3 = c2;
                    c2 = c;
                    s2 = s;
                    g = c * e[i];
                    h = c * p;
                    r = hypot2(p, e[i]);
                    e[i+1] = s * r;
                    s = e[i] / r;
                    c = p / r;
                    p = c * d[i] - s * g;
                    d[i+1] = h + s * (c * g + s * d[i]);
                    /* Accumulate transformation. */
                    for (k = 0; k < nn; k++) 
                    {
                        h = V[k][i+1];
                        V[k][i+1] = s * V[k][i] + c * h;
                        V[k][i] = c * V[k][i] - s * h;
                    }
                }
                p = -s * s2 * c3 * el1 * e[l] / dl1;
                e[l] = s * p;
                d[l] = c * p;
                
                /* Check for convergence. */
            } while (fabs(e[l]) > eps*tst1);
        }
        d[l] = d[l] + f;
        e[l] = 0.0;
    }
    
    /* Sort eigenvalues and corresponding vectors. */
    for (i = 0; i < nn-1; i++) 
    {
        k = i;
        p = d[i];
        for (j = i+1; j < nn; j++) 
        {
            if (d[j] < p) 
            {
                k = j;
                p = d[j];
            }
        }
        if (k != i) 
        {
            d[k] = d[i];
            d[i] = p;
            for (j = 0; j < nn; j++) 
            {
                p = V[j][i];
                V[j][i] = V[j][k];
                V[j][k] = p;
            }
        }
    }
}

void eigen_decomposition(double A[nn][nn], double V[nn][nn], double d[nn]) 
{
    double e[nn];
    double da[3];
    double dt, dat;
    double vet[3];
    int i, j;

    for (i = 0; i < nn; i++) 
        for (j = 0; j < nn; j++) 
            V[i][j] = A[i][j];
	//tred2_2(V, d, e);
    tred2(V, d, e);


    tql2(V, d, e);

    /* Sort the eigen values and vectors by abs eigen value */
    //da[0]=absd(d[0]); da[1]=absd(d[1]); da[2]=absd(d[2]);
	da[0]=fabs(d[0]); da[1]=fabs(d[1]); da[2]=fabs(d[2]);
    if((da[0]>=da[1])&&(da[0]>da[2]))
    {
        dt=d[2];   dat=da[2];    vet[0]=V[0][2];    vet[1]=V[1][2];    vet[2]=V[2][2];
        d[2]=d[0]; da[2]=da[0];  V[0][2] = V[0][0]; V[1][2] = V[1][0]; V[2][2] = V[2][0];
        d[0]=dt;   da[0]=dat;    V[0][0] = vet[0];  V[1][0] = vet[1];  V[2][0] = vet[2]; 
    }
    else if((da[1]>=da[0])&&(da[1]>da[2]))  
    {
        dt=d[2];   dat=da[2];    vet[0]=V[0][2];    vet[1]=V[1][2];    vet[2]=V[2][2];
        d[2]=d[1]; da[2]=da[1];  V[0][2] = V[0][1]; V[1][2] = V[1][1]; V[2][2] = V[2][1];
        d[1]=dt;   da[1]=dat;    V[0][1] = vet[0];  V[1][1] = vet[1];  V[2][1] = vet[2]; 
    }
    if(da[0]>da[1])
    {
        dt=d[1];   dat=da[1];    vet[0]=V[0][1];    vet[1]=V[1][1];    vet[2]=V[2][1];
        d[1]=d[0]; da[1]=da[0];  V[0][1] = V[0][0]; V[1][1] = V[1][0]; V[2][1] = V[2][0];
        d[0]=dt;   da[0]=dat;    V[0][0] = vet[0];  V[1][0] = vet[1];  V[2][0] = vet[2]; 
    }
}

void getHessianDecomposition3D (double EigVal[3],
                                double EigVec[3][3],
                                double* hes_elem)
{    
  double Hessian[3][3];

	Hessian[0][0]=hes_elem[0]; Hessian[0][1]=hes_elem[3]; Hessian[0][2]=hes_elem[4];
	Hessian[1][0]=hes_elem[3]; Hessian[1][1]=hes_elem[1]; Hessian[1][2]=hes_elem[5];
	Hessian[2][0]=hes_elem[4]; Hessian[2][1]=hes_elem[5]; Hessian[2][2]=hes_elem[2];
	
	eigen_decomposition(Hessian, EigVec, EigVal);
}

void getHessianDecomposition2D (double EigVal[2], double hes_elem[3],
                                 double EigVect1[2], double EigVect2[2])
{
  double tmp;
  double Dxx = hes_elem[0];
  double Dxy = hes_elem[1];
  double Dyy = hes_elem[2];
  double Discriminant = sqrt((Dxx - Dyy)*(Dxx - Dyy) + 4*Dxy*Dxy);
  EigVect2[0] = Dxx - Dyy + Discriminant;
  EigVect2[1] = 2*Dxy;

  double norm = sqrt(EigVect2[0]*EigVect2[0] + EigVect2[1]*EigVect2[1]);

  if (norm > 1e-14)
  {
    EigVect2[0] /= norm;
    EigVect2[1] /= norm;
  }

  EigVect1[0] = -EigVect2[1]; 
  EigVect1[1] = EigVect2[0];

  EigVal[0] = 0.5*(Dxx + Dyy - Discriminant);
  EigVal[1] = 0.5*(Dxx + Dyy + Discriminant);

  if ( fabs(EigVal[0]) > fabs(EigVal[1]) )
  {
    tmp = EigVal[0]; EigVal[0] = EigVal[1]; EigVal[1] = tmp;
    tmp = EigVect1[0]; EigVect1[0] = EigVect2[0]; EigVect2[0] = tmp;
    tmp = EigVect1[1]; EigVect1[1] = EigVect2[1]; EigVect2[1] = tmp;
  }
}
