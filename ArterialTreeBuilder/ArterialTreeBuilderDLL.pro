QT -= gui

TEMPLATE = lib
DEFINES += ARTERIALTREEBUILDERDLL_LIBRARY

CONFIG += c++11

# The following define makes your compiler emit warnings if you use
# any Qt feature that has been marked deprecated (the exact warnings
# depend on your compiler). Please consult the documentation of the
# deprecated API in order to know how to port your code away from it.
DEFINES += QT_DEPRECATED_WARNINGS

# You can also make your code fail to compile if it uses deprecated APIs.
# In order to do so, uncomment the following line.
# You can also select to disable deprecated APIs only up to a certain version of Qt.
#DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000    # disables all the APIs deprecated before Qt 6.0.0
win32 {
    CONFIG(release, debug|release) {
        QMAKE_LFLAGS += /LARGEADDRESSAWARE
        RBUILD = release
    }
    else {
        QMAKE_LFLAGS += /LARGEADDRESSAWARE /NODEFAULTLIB:msvcrt
        RBUILD = debug
    }

    INCLUDEPATH += Headers
    INCLUDEPATH += Headers/lws/unix/include

    ITK_DIR = "D:/Users/german/Desktop/V5/ITK501"
#    ITK_DIR = "D:/Users/german/Desktop/V5/ITK"
    ver = "5.0"
    INCLUDEPATH += $$ITK_DIR/include/ITK-$$ver
    LIBS += -L$$ITK_DIR/lib

    INCLUDEPATH += $$ITK_DIR/include/ITK-$$ver
    LIBS += -L$$ITK_DIR/lib
    //files = $$files($$ITK_DIR/lib)
    //LIBS += $$files(*, true)
    //LIBS += -lITKCommon-$$ver -litkvnl-$$ver -litkvnl_algo-$$ver -lITKIOImageBase-$$ver -litksys-$$ver
    //LIBS += -lITKSpatialObjects-$$ver -lITKIOMeshBase-$$ver -litkIOMeshSTL-$$ver -lITKIOPNG-$$ver
    //LIBS += -lITKIOGDCM-$$ver -litkv3p_netlib-$$ver

    LIBS += -lITKDOUBLE-CONVERSION-$$ver
    LIBS += -lITKSYS-$$ver
    LIBS += -lITKVNL_ALGO-$$ver
    LIBS += -lITKVNL-$$ver
    LIBS += -lITKV3P_NETLIB-$$ver
    LIBS += -lITKNETLIB-$$ver
    LIBS += -lITKVCL-$$ver
    LIBS += -lITKCOMMON-$$ver
    LIBS += -lITKIOIMAGEBASE-$$ver
    LIBS += -lITKNETLIBSLATEC-$$ver
    LIBS += -lITKSTATISTICS-$$ver
    LIBS += -lITKTRANSFORM-$$ver
    LIBS += -lITKMESH-$$ver
    LIBS += -lITKQUADEDGEMESH-$$ver
    LIBS += -lITKIOMESHBASE-$$ver
    LIBS += -lITKIOMESHSTL-$$ver
    LIBS += -lITKZLIB-$$ver
    LIBS += -lITKMETAIO-$$ver
    LIBS += -lITKSPATIALOBJECTS-$$ver
    LIBS += -lITKPATH-$$ver
    LIBS += -lITKLABELMAP-$$ver
    #LIBS += -lITKSMOOTHING-$$ver
    LIBS += -lITKOPTIMIZERS-$$ver
    LIBS += -lITKPOLYNOMIALS-$$ver
    LIBS += -lITKBIASCORRECTION-$$ver
    #LIBS += -lITKCOLORMAP-$$ver
    #LIBS += -lITKCONVOLUTION-$$ver
    LIBS += -lITKDICOMPARSER-$$ver
    #LIBS += -lITKDENOISING-$$ver
    #LIBS += -lITKDIFFUSIONTENSORIMAGE-$$ver
    LIBS += -lITKEXPAT-$$ver
    LIBS += -lITKGDCMDICT-$$ver
    LIBS += -lITKGDCMMSFF-$$ver
    LIBS += -lITKZNZ-$$ver
    LIBS += -lITKNIFTIIO-$$ver
    LIBS += -lITKGIFTIIO-$$ver
    #LIBS += -lLIBITKHDF5_CPP_D
    #LIBS += -lLIBITKHDF5_D
    LIBS += -lITKIOBMP-$$ver
    LIBS += -lITKIOBIORAD-$$ver
    LIBS += -lITKIOBRUKER-$$ver
    LIBS += -lITKIOCSV-$$ver
    LIBS += -lITKIOGDCM-$$ver
    LIBS += -lITKIOIPL-$$ver
    LIBS += -lITKIOGE-$$ver
    LIBS += -lITKIOGIPL-$$ver
    LIBS += -lITKIOHDF5-$$ver
    LIBS += -lITKJPEG-$$ver
    LIBS += -lITKIOJPEG-$$ver
    LIBS += -lITKOPENJPEG-$$ver
    LIBS += -lITKIOJPEG2000-$$ver
    LIBS += -lITKTIFF-$$ver
    LIBS += -lITKIOTIFF-$$ver
    LIBS += -lITKIOLSM-$$ver
    LIBS += -lITKMINC2-$$ver
    LIBS += -lITKIOMINC-$$ver
    LIBS += -lITKIOMRC-$$ver
    LIBS += -lITKIOMESHBYU-$$ver
    LIBS += -lITKIOMESHFREESURFER-$$ver
    LIBS += -lITKIOMESHGIFTI-$$ver
    LIBS += -lITKIOMESHOBJ-$$ver
    LIBS += -lITKIOMESHOFF-$$ver
    LIBS += -lITKIOMESHVTK-$$ver
    LIBS += -lITKIOMETA-$$ver
    LIBS += -lITKIONIFTI-$$ver
    LIBS += -lITKNRRDIO-$$ver
    LIBS += -lITKIONRRD-$$ver
    LIBS += -lITKPNG-$$ver
    LIBS += -lITKIOPNG-$$ver
    LIBS += -lITKIOSIEMENS-$$ver
    LIBS += -lITKIOXML-$$ver
    LIBS += -lITKIOSPATIALOBJECTS-$$ver
    LIBS += -lITKIOSTIMULATE-$$ver
    LIBS += -lITKTRANSFORMFACTORY-$$ver
    LIBS += -lITKIOTRANSFORMBASE-$$ver
    LIBS += -lITKIOTRANSFORMHDF5-$$ver
    LIBS += -lITKIOTRANSFORMINSIGHTLEGACY-$$ver
    LIBS += -lITKIOTRANSFORMMATLAB-$$ver
    LIBS += -lITKIOVTK-$$ver
    LIBS += -lITKKLMREGIONGROWING-$$ver
    LIBS += -lITKLBFGS-$$ver
    #LIBS += -lITKMARKOVRANDOMFIELDSCLASSIFIERS-$$ver
    LIBS += -lITKOPTIMIZERSV4-$$ver
    LIBS += -lITKTESTKERNEL-$$ver
    LIBS += -lITKVTK-$$ver
    LIBS += -lITKVIDEOCORE-$$ver
    LIBS += -lITKVIDEOIO-$$ver
    LIBS += -lITKWATERSHEDS-$$ver
    LIBS += -lITKGDCMIOD-$$ver
    LIBS += -lITKGDCMDSED-$$ver
    LIBS += -lITKGDCMCOMMON-$$ver
    LIBS += -lITKGDCMJPEG8-$$ver
    LIBS += -lITKGDCMJPEG12-$$ver
    LIBS += -lITKGDCMJPEG16-$$ver
    LIBS += -lITKGDCMOPENJP2-$$ver
    LIBS += -lITKGDCMCHARLS-$$ver
    LIBS += -lITKVNLINSTANTIATION-$$ver
    LIBS += -lITKCommon-$$ver

    LIBS += -lUser32 -lKernel32 -lGdi32 -lUserEnv -lAdvAPI32 -lopengl32 -lWs2_32 -lShell32
}


SOURCES += \
    ArterialTreeBuilder.cpp \
    arterialtreebuilderdll.cpp \
    eigen.cpp \
    ffrservice.cpp \
    graph.cpp \
    hessian2d3d.cpp \
    hessian_filters.cpp \
    idt.cpp \
    imgaussian.cpp \
    lws.cpp \
    main.cpp \
    stdafx.cpp \
    thinner.cpp \
    tracer.cpp \
    utils.cpp \
    vtb.cpp

HEADERS += \
    ArterialTreeBuilderDLL_global.h \
    Headers/configuration.h \
    Headers/eigen.hpp \
    Headers/graph.h \
    Headers/hessian2d3d.hpp \
    Headers/hessian_filters.hpp \
    Headers/idt.hpp \
    Headers/imgaussian.hpp \
    Headers/thinner.hpp \
    Headers/utils.h \
    Headers/vtb.hpp \
    Resource.h \
    arterialtreebuilderdll.h \
    ffrservice.h \
    stdafx.h \
    targetver.h \
    tracer.h

# Default rules for deployment.
unix {
    target.path = /usr/lib
}
!isEmpty(target.path): INSTALLS += target
