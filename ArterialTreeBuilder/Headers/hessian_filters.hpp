#ifndef HESSIAN_FILTERS_HPP
#define HESSIAN_FILTERS_HPP
//#include <vector>

/*==========================================*/
/*  Parameters:                             */
/*  Image       -- data array               */
/*  dims        -- size of data array       */
/*  sigmasInfo  -- [minSigma,maxSigma,step] */
/*  Falpha }                                */
/*  Fbeta  }    -- Frangi parameters        */
/*  Fc     }                                */
/*==========================================*/
void FrangiFilter3d (double * Vesselness, bool firstUse,
                        short *Image, unsigned long long *dims,
                        double *sigmasInfo,
                        double Falpha, double Fbeta, double Fc,
                        bool mod);

void FrangiFilter3d_AMP (double * Vesselness, bool firstUse,
                        short *Image, unsigned long long *dims,
                        double *sigmasInfo,
                        double Falpha, double Fbeta, double Fc,
                        bool mod);

double* FrangiFilter3dReturnOptimalScales
                        (short *Image, unsigned long long *dims,
                        double *sigmasInfo,
                        bool returnOptimalScales, double *optimalScales,
                        double Falpha, double Fbeta, double Fc);

double* BifurcationFilter3d (short *Image,
                             unsigned long long *dims,
                             double *sigmasInfo,
                             double beta);

double* CirclenessFilter2d (short * Image,
                             unsigned long long *dims,
                             double optimalScale,
                             double alpha, double beta);

#endif /*HESSIAN_FILTERS_HPP*/