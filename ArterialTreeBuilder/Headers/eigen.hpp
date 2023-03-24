#ifndef EIGEN_HPP
#define EIGEN_HPP
void getHessianDecomposition3D (double EigVal[3],
								double EigVec[3][3],
								double* hes_elem);
void getHessianDecomposition2D (double EigVal[2],
								double hes_elem[3],
								double EigVect1[2],
								double EigVect2[2]);
#endif /*EIGEN_HPP*/