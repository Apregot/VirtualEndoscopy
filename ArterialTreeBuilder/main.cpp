//#include <arpa/inet.h>  // а это для кого?
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>         // getpid, sleep
#include <signal.h>         // kill
#include <stdlib.h>
#include <iostream>
#include <sstream>
#include <cassert>
#include <unistd.h>
#include "mvox.h"
#include "tracer.h"
using namespace std;


//=======================================

// /InsightToolkit-5.0.1/Examples/IO/DicomSeriesReadSeriesWrite.cpp
#include "itkGDCMImageIO.h"
#include "itkGDCMSeriesFileNames.h"
#include "itkImageSeriesReader.h"
#include <gdcmUIDGenerator.h>
#include "itkImportImageContainer.h"

// InsightToolkit-5.0.1/Examples/IO/DicomPrintPatientInformation.cpp
//
std::string FindDicomTag( const std::string & entryId, const itk::GDCMImageIO::Pointer dicomIO )
{
  std::string tagvalue;
  bool found = dicomIO->GetValueFromTag(entryId, tagvalue);
  if ( !found )
    {
    tagvalue = "NOT FOUND";
    }
  return tagvalue;
}

void printDictionary(const itk::GDCMImageIO::Pointer dicomIO) {
    tracer.log("printDictionary()");
    using DictionaryType = itk::MetaDataDictionary;
    const  DictionaryType & dictionary = dicomIO->GetMetaDataDictionary();
    using MetaDataStringType = itk::MetaDataObject< std::string >;
    auto itr = dictionary.Begin();
    auto end = dictionary.End();
    int diciItems = 0;
    while( itr != end )
      {
      diciItems++;
      itk::MetaDataObjectBase::Pointer  entry = itr->second;

      MetaDataStringType::Pointer entryvalue =
        dynamic_cast<MetaDataStringType *>( entry.GetPointer() );
      if( entryvalue )
        {
        std::string tagkey   = itr->first;
        std::string labelId;
        bool found =  itk::GDCMImageIO::GetLabelFromTag( tagkey, labelId );
        std::string tagvalue = entryvalue->GetMetaDataObjectValue();
        if( found )
          {
          std::cout << "(" << tagkey << ") " << labelId;
          std::cout << " = " << tagvalue.c_str() << std::endl;
          }
        else
          {
          std::cout << "(" << tagkey <<  ") " << "Unknown";
          std::cout << " = " << tagvalue.c_str() << std::endl;
          }
        }

      ++itr;
      }
    tracer.logInt("diciItems",diciItems);
}

// чтение DICOM dir и возврат в виде mvox::Cube
//
mvox::Cube readDicomDir(std::string dirName) {
    mvox::Cube cube; cube.Data = nullptr; cube.width = cube.height = cube.depth = 0;
    using PixelType = signed short;
    constexpr unsigned int Dimension = 3;

    using ImageType = itk::Image< PixelType, Dimension >;
    using ReaderType = itk::ImageSeriesReader< ImageType >;

    using ImageIOType = itk::GDCMImageIO;
    using NamesGeneratorType = itk::GDCMSeriesFileNames;

    ImageIOType::Pointer gdcmIO = ImageIOType::New();
    NamesGeneratorType::Pointer namesGenerator = NamesGeneratorType::New();

    namesGenerator->SetInputDirectory( dirName );

    const ReaderType::FileNamesContainer & filenames = namesGenerator->GetInputFileNames();
    std::size_t numberOfFileNames = filenames.size();

//    for(unsigned int fni = 0; fni < numberOfFileNames; ++fni)
//      {
//          std::cout << "filename # " << fni << " = ";
//          std::cout << filenames[fni] << std::endl;
//      }
    tracer.logInt("## of files original",numberOfFileNames);

    ReaderType::Pointer reader = ReaderType::New();

    reader->SetImageIO( gdcmIO );
    reader->SetFileNames( filenames );

    try
      {
      // Software Guide : BeginCodeSnippet
      reader->Update();
      // Software Guide : EndCodeSnippet
      }
    catch (itk::ExceptionObject &excp)
      {
      std::cerr << "Exception thrown while writing the image" << std::endl;
      std::cerr << excp << std::endl;
      return cube;
      }

    //printDictionary(gdcmIO);

    auto img = reader->GetOutput();
    ImageType::RegionType inputRegion = img->GetLargestPossibleRegion();
    ImageType::SizeType size = inputRegion.GetSize();
    std::cout << size[0] <<' '<<size[1] << ' '<<size[2]<<std::endl;
    std::cout << "origin=" << img->GetOrigin() << " spacing="<< img->GetSpacing()<< std::endl;

    PixelType *data = (PixelType *)img->GetPixelContainer()->GetImportPointer();
    //cout << "img->GetPixelContainer()->Size()=" << img->GetPixelContainer()->Size() << endl;

    // приходится делать копию, так как данные reader'а умирают вместе с ним
    // фреймы копируем в обратном порядке по Z, почему-то порядок фреймов в ITK и MVOX обратный
    int pixelNums = size[0] * size[1] * size[2];
    PixelType *buf_base = new PixelType[pixelNums], *buf=buf_base;

    cube.Data = data;
    cube.Format = mvox::sY2;
    cube.scaleX = img->GetSpacing()[0];
    cube.scaleY = img->GetSpacing()[1];
    cube.scaleZ = img->GetSpacing()[2];
    cube.width  = size[0];
    cube.height = size[1];
    cube.depth  = size[2];
//    memcpy( buf_base, data, pixelNums*sizeof(PixelType));
//    cube.Data = buf_base;

#if 1   // для почукаевой надо переворачивать стек, а для Колмакова нет
    int sliceSize = size[0] * size[1] * sizeof(PixelType);
    for(int z=size[2]-1; z >= 0; z--) {
        PixelType *slice = cube.GetSlice<short>(z);
        memcpy( buf, slice, sliceSize);
        buf += (size[0] * size[1]);
    }
    cube.Data = buf_base;
#endif

    //cube.SpaceToImage = ?; //Matrix4x4<float> SpaceToImage;
#if 0
    std::string patientName  = FindDicomTag("0010|0010", gdcmIO);
    std::string patientID    = FindDicomTag("0010|0020", gdcmIO);
    std::string patientSex   = FindDicomTag("0010|0040", gdcmIO);
    std::string patientAge   = FindDicomTag("0010|1010", gdcmIO);
    std::string studyDate    = FindDicomTag("0008|0020", gdcmIO);
    std::string modality     = FindDicomTag("0008|0060", gdcmIO);
    std::string manufacturer = FindDicomTag("0008|0070", gdcmIO);
    std::string institution  = FindDicomTag("0008|0080", gdcmIO);
    std::string model        = FindDicomTag("0008|1090", gdcmIO);
    std::string spacing      = FindDicomTag("0028|9110", gdcmIO);// x00289110 x00280030
    std::string patientOrientation= FindDicomTag("0020|0020", gdcmIO);

    std::string ImagePosition= FindDicomTag("0020|0032", gdcmIO);// x00200032


    std::cout << "Patient Name : " << patientName  << std::endl;
    std::cout << "Patient ID   : " << patientID    << std::endl;
    std::cout << "Patient Sex  : " << patientSex   << std::endl;
    std::cout << "Patient Age  : " << patientAge   << std::endl;
    std::cout << "Study Date   : " << studyDate    << std::endl;
    std::cout << "Modality     : " << modality     << std::endl;
    std::cout << "Manufacturer : " << manufacturer << std::endl;
    std::cout << "Institution  : " << institution  << std::endl;
    std::cout << "Model        : " << model        << std::endl;
    std::cout << "spacing      : " << spacing      << std::endl;
    std::cout << "patientOrientation 0020|0020: " << patientOrientation<< std::endl;
    std::cout << "ImagePosition 0020|0032: " << ImagePosition<< std::endl;
    std::cout << "ImageOrientation 0020|0037: " << FindDicomTag("0020|0037", gdcmIO) << std::endl;
#endif
    return cube;
}

// прореживание серии
// coef - коэффициент прореживания
//
#include "itkImageFileReader.h"
#include "itkImageFileWriter.h"

void thinOutSeries(std::string sampleSlice) {
    using InputPixelType = signed short;
    constexpr unsigned int InputDimension = 2;
    using InputImageType = itk::Image< InputPixelType, InputDimension >;
    using ReaderType = itk::ImageFileReader< InputImageType >;

    ReaderType::Pointer reader = ReaderType::New();
    reader->SetFileName( sampleSlice );
    using ImageIOType = itk::GDCMImageIO;
    ImageIOType::Pointer gdcmImageIO = ImageIOType::New();
    reader->SetImageIO( gdcmImageIO );

    try
      {
      reader->Update();
      }
    catch (itk::ExceptionObject & e)
      {
      std::cerr << "exception in file reader " << std::endl;
      std::cerr << e << std::endl;
      return;
      }

    using Writer1Type = itk::ImageFileWriter< InputImageType >;
    Writer1Type::Pointer writer1 = Writer1Type::New();
    std::string outSlice = "";
    writer1->SetFileName( outSlice );
    writer1->SetInput( reader->GetOutput() );
    writer1->SetImageIO( gdcmImageIO );
    try
      {
      writer1->Update();
      }
    catch (itk::ExceptionObject & e)
      {
      std::cerr << "exception in file writer " << std::endl;
      std::cerr << e << std::endl;
      return;
      }


}
void testDicomDirReader(std::string dirName) {
#if 0
    using PixelType = signed short;
    constexpr unsigned int Dimension = 3;

    using ImageType = itk::Image< PixelType, Dimension >;

    ImageType::IndexType start; start.Fill(0);
    ImageType::IndexType pixelIndex = start;
    int cnt = 0;
    PixelType *data = (PixelType *)img->GetPixelContainer()->GetImportPointer();

    std::cout<< "data="<<data<<" data[0]="<<data[0]<<std::endl;
    std::cout<< "data="<<data<<" data[512]="<<data[512]<<std::endl;
    for (ImageType::IndexValueType i = 0; i < size[0]; i++)
        for (ImageType::IndexValueType j = 0; j < size[1]; j++)
            for (ImageType::IndexValueType k = 0; k < size[2]; k++) {
                ImageType::IndexValueType ind[] = {i,j,k};
                pixelIndex.SetIndex(ind);
                cnt++;
                if(img->GetPixel(pixelIndex)) {
                    std::cout <<cnt<< img->GetPixel(pixelIndex) << pixelIndex<< std::endl;
                    return;
                }
            }
#endif
}

void cube_test_1(mvox::Cube cube) {
    tracer.log("cube_test_1");
    // обратимся к последнему вокселю
//    int lastInd = cube.width * cube.height * cube.depth - 1;
//    cout << "lastInd=" << lastInd << endl;
//    short *data = (short *)cube.Data;
//    cout << "data[lastInd]=" << data[lastInd] << endl;

    // вывести в лог первые 16x16 пикселей
    int z=100, cols=16, cnt=0, maxVals=300;
    tracer.logInt("z",z);
    std::string str = "";
    for(int y=0; y<cube.height; y++) {
        for(int x=0; x<cube.width; x++) {
            cnt++; if(cnt >= maxVals) {tracer.log(str); return;}
            str += std::to_string(cube.GetValue<short>(x,y,z)); str += " ";
            if(cnt%cols == 0) {
                tracer.log(str);
                str = "";
            }
        }
    }
}

void myTextWriter(wchar_t* text) {
    tracer.log(" myTextWriter()");
    std::wstring ws(text);
    string str(ws.begin(), ws.end());
    cout << "ws size="<<ws.size() << "s.size="<<str.size() <<endl;
    ofstream o("input_data.tre");
    o << str;
    o.close();
}

void my_update_progres(float relativeProgress, const wchar_t* status) {
    std::wstring ws(status);
    string str(ws.begin(), ws.end());
    str += " "; str += std::to_string(relativeProgress*100); str += "%";
    tracer.log(str);
}

bool expected(double val, double ref, double tol=0.001) {
    return fabs(val-ref) < tol;
}

static void cube_clear(mvox::Cube cube) {
    if(!cube.Data) return;
    int pixelSize = mvox::PixelFormatUtils::PixelFormatBytesPerPixel(cube.Format);
    int size = cube.width*cube.height*cube.depth*pixelSize;
    uint8_t *data = (uint8_t *)cube.Data;
    for(int i=0; i<size; i++)
        data[i] = 0;
}

//std::string dir("/mnt/d/Users/german/Desktop/V5/Тимур/Почукаева/DICOM/PA1/ST1/SE2");
//mvox::Cube cube = readDicomDir(dir);
//std::string atb_cube_449 = "/mnt/d/xampp/htdocs/V5-FFR/atb-cube-pochukaeva-449.bin";
//write_cube(cube,atb_cube_449);
//return;
//
void Pochukaeva() {
    tracer.log("Почукаева-113");
//    wstring ws = L"Hello";
//    wcout << ws << endl;
//    string ss(ws.begin(),ws.end());
//    cout << ss << endl;
//    return;

    //std::string ffr_cube_113 = "/mnt/d/xampp/htdocs/V5-FFR/ffr-cube-pochukaeva-113.bin";
    std::string ffr_cube_113 = "/mnt/c/xampp/htdocs/atb-cube-pochukaeva-113.bin";
    mvox::Cube cube = {nullptr, mvox::PixelFormat::sY2, 512, 512, 113, 0.405, 0.405, 1.0};
    cube.ImageToSpace = {0.405, 0, 0, 0, 0, 0.405, 0, 0, 0, 0, 1, 0, -53.7033, -134.172, -927, 1};
    cube.SpaceToImage = {2.46914, -0, 0, -0, -0, 2.46914, -0, 0, 0, -0, 1, -0, 132.601, 331.289, 927, 1};
    read_cube(cube, ffr_cube_113);
    assert(cube.Data);      // я похоже в release mode на Ubuntu

    // step 1
    mvox::Point3D_Double point; double radius;
    tracer.startInterval("AortaSearch_FindAorta");
    //AortaSearch_FindAorta(cube, &point, &radius);
    tracer.logInterval("AortaSearch_FindAorta");

    // ожидаемые величины на Почукаева-449 и Почукаева-113
//    point 12.7167 -29.682 -815
//    point on slice 164 258 448
//    rad = 19.0888
    if(!expected(point.x,12.7167) || !expected(point.y,-29.682) ||
            !expected(point.z,-815) || !expected(radius,19.0888)) {
        tracer.log("expected values differ from calculated");
        stringstream ss; ss << point.x <<' ' << point.y <<' '<<point.z << ' '<< radius<<endl;
        tracer.log(ss.str());
        return;
    }
    tracer.log("calculated values returned as expected");

    // step 2
    tracer.log("Step 2:");
    // это копия из AortaTreeBuilder.cpp
    FFRSettings settings;

    // фактические данные, которые передает mvox в FFR см. sketches/Почукаева/ffr_initialize_log.txt
    // некоторые сомнения вызывает AortaAverageIntensity = 361.178
    // Это интенсивность в DICOM'е mvox, а у него интенсивности пикселей отличаются от DICOM ITK (см. cube_test_1)
    // однако радиус и центр аорты были вычислены на step-1 правильно, поэтому попробуем с такими значениями
    //
    settings.AortaAverageIntensity = 361.178;
    settings.AortaInitialPoint.x = 12.7167;
    settings.AortaInitialPoint.y = -29.682;
    settings.AortaInitialPoint.z = -815;        // так ли?
    settings.AortaRadius = 19.0888;
    settings.aortaThreshold = 1140850688;
    settings.frangiThreshold = -29.682;
    settings.idtStopParameter = 0;
    settings.maxNoiseLength = 1076457203;
    settings.minDistBetweenOstia = 0;
    settings.minNumOfVoxelsInBranch = 3230234624;

    tracer.startInterval("FFR_Initialize");
    FFRProcessor *FFR = FFR_Initialize(settings);
    tracer.logInterval("FFR_Initialize");

    tracer.startInterval("FFR_FFR_Process_PrepareAortaProc");
    FFR_Process_PrepareAortaProc(FFR,cube,my_update_progres);  // processor->segmAorta() log_dataInfo.txt this->vtb->preprocessAorta();
    tracer.logInterval("FFR_FFR_Process_PrepareAortaProc");
    //return;

    // в FFR_Process_LoadAortaPreview куб байтовый
    mvox::Cube segmCube;
    segmCube.width = cube.width; segmCube.height = cube.height; segmCube.depth = cube.depth;
    int size = segmCube.width * segmCube.height * segmCube.depth;
    segmCube.Data = new char[size];
    segmCube.Format = mvox::Y;
    char *data = (char *)segmCube.Data;
    for(int i=0; i<size; i++)
        data[i] = 0;
    FFR_Process_LoadAortaPreview(FFR, segmCube, 1, 0.09);
    printf("segmCube.data=%p size=%d\n",segmCube.Data,size);
    int non0=0, firstOne=-1, lastOne=-1, zero=0;
    for(int i=0; i<size; i++) {
        if(!(data[i] ==0 || data[i] == 1)) {
            printf("data[%d] == %d\n",i, data[i]);
            break;
        }
        if(data[i] == 1) {
            non0++;
            if(firstOne == -1) firstOne = i;
            lastOne = i;
        }
        if(data[i] == 0) zero++;
    }
    printf("non0=%d first=%d last=%d zero=%d\n",non0,firstOne,lastOne,zero);
    std::string mask_pochukaeva_113 = "/mnt/c/xampp/htdocs/mask-pochukaeva-113.bin";
    write_cube(segmCube,mask_pochukaeva_113);
    return;

    // step 3
    tracer.log("Step 3:");
    VesselsSegmParameters params = {0.09, 0.5, 0.5, 500.};
    FFR_Process_PrepareVesselsProc(FFR, cube, my_update_progres,params);
    FFR_Process_SetVesselsSeeds(FFR, nullptr,0);
    cube_clear(segmCube);
    FFR_Process_LoadVesselsPreview(FFR, segmCube, 10, 20.);
    tracer.log("Step 3 finished");
    //return;

    // step 4
    tracer.log("Step 4:");

    CompleteParameters completeParameters = {{0.09,0.5,0.5,500},20};
    int retcode = FFR_Process(FFR,cube,my_update_progres,completeParameters);
    tracer.logInt("FFR_Process() returned",retcode);
    FFR_LoadAortaObject(FFR,segmCube,10);
    tracer.log("FFR_LoadAortaObject() returned");
    int objectsCount = FFR_GetVesselsObjectsCount(FFR);
    tracer.logInt("FFR_GetVesselsObjectsCount() returned",objectsCount);
    for(int i=0; i<objectsCount; i++) {
        cube_clear(segmCube);
        FFR_LoadVesselsObject(FFR,segmCube,10,i);
    }
    int vesselsCount = FFR_GetVesselsCount(FFR);
    tracer.logInt("FFR_GetVesselsCount() returned",vesselsCount);
    for(int vesselIndex = 0; vesselIndex < vesselsCount; vesselIndex++) {
        int centerLineCount, bifurcationsCount; wchar_t name[64];
        FFR_GetVesselInfo(FFR,vesselIndex,&centerLineCount,&bifurcationsCount,name);
        mvox::Point3D_Double points[512];   // размер должен быть достаточным
        FFR_GetVesselBifurcations(FFR,vesselIndex,points,bifurcationsCount);
        FFR_GetVesselCenterLine(FFR,vesselIndex,points,centerLineCount);
    }
    tracer.log("Step 4 finished");

    // step 5
    tracer.log("Step 5:");
    FFRStenosis stenosis={1,Stenosis,
                          {{63.4535,-31.0003,-839.993},3.4308},
                          {{66.5106,-31.9216,-841},5.30301},
                          {{60.3647,-29.8682,-839.992},6.12946},0};
    FFR_PrepareResult(FFR, &stenosis, 1,myTextWriter);

//    FFRStenosis={id=1,type=0,UserStenosisPercent0..
//     Center={(63.4535,-31.0003,-839.993) area=3.4308)
//    Front={(66.5106,-31.9216,-841) area=5.30301)
//    Rear={(60.3647,-29.8682,-839.992) area=6.12946)

    return;
}

// Томск Колмаков
//
void Tomsk() {
    tracer.log("Томск Колмаков");
//    std::string dir("/mnt/d/Users/german/Desktop/V5/Тимур/DICOMDIT/PA0/ST0/SE0");
    std::string dir("/mnt/c/xampp/htdocs/DICOMDIT/PA0/ST0/SE0");
    mvox::Cube cube = readDicomDir(dir); //return;
    // ATB: origin=[-101.7, -170.5, -205] spacing=[0.492188, 0.492188, 0.625]
    // FFR: origin=[-101.7, -170.5, -205] spacing=[0.492188, 0.492188, 0.625]
    cube.ImageToSpace = {0.492188, 0, 0, 0, 0, 0.492188 , 0, 0, 0, 0, 0.625, 0, -101.7, -170.5, -205, 1};
    cube.SpaceToImage = {2.03174, -0, 0, -0, -0, 2.03174, -0, 0, 0, -0, 1.6, -0, 206.628, 346.412, 328, 1};

    mvox::Point3D_Double point; double radius;
    //AortaSearch_FindAorta(cube, &point, &radius);
    printf("point=(%f %f %f) radius=%f\n",point.x, point.y, point.z, radius);
    // ATB: slice 92 239 192 AortaSearch_FindAorta returned point=(-56.4187,-52.8671,-85) radius=18.2913
    // FFR: point -15.5671 -38.5936 -85 point on slice 175 268 192 rad = 20.2213
    // Да, если Колмакова не переворачивать, то он возвращает такие же числа как FFR

    // Похоже, что Колмыкова не надо переворачивать. Да, картинки различаются
}

// возникла неожиданная проблема с Томском (Колмыков). Куб, который передается FFR.dll в мультивоксе
// отличается от куба, который получает ATB.
// В результате AortaSearch_FindAorta находит не тот срез аорты. Причем для
// прореженной Почукаевой (почукаева-113) совпадение кубов полное.
//
void cmp_Tomsk() {
    string fileATB = "/mnt/c/xampp/htdocs/atb-cube-tomsk-193.bin";
    string fileMVX = "/mnt/c/xampp/htdocs/ffr-cube-tomsk-193.bin";
    mvox::Cube cubeATB, cubeMVX;
    cubeATB.Format = mvox::PixelFormat::Y2;
    cubeATB.width = 512; cubeATB.height = 512; cubeATB.depth = 193;
    cubeATB.scaleX = 0.492188; cubeATB.scaleY = 0.492188; cubeATB.scaleZ= 0.625;
    cubeATB.ImageToSpace = {0.492188, 0, 0, 0, 0, 0.492188 , 0, 0, 0, 0, 0.625, 0, -101.7, -170.5, -205, 1};
    cubeATB.SpaceToImage = {2.03174, -0, 0, -0, -0, 2.03174, -0, 0, 0, -0, 1.6, -0, 206.628, 346.412, 328, 1};
    cubeMVX = cubeATB;

    read_cube(cubeATB, fileATB);
    read_cube(cubeMVX, fileMVX);
    short *a = (short *)cubeATB.Data;
    short *x = (short *)cubeMVX.Data;
    size_t length = 512*512*193, i;
    for(i=0; i<length; i++) {
        short dv = a[i] - x[i];
        if(dv != 1024) break;
    }
    int IJK[3]; cubeATB.lin2IJK(i, IJK);
    printf("%d/%d %d=[%d %d %d]", a[i], x[i], (int)i, IJK[0], IJK[1], IJK[2]);
    printf("\n");
}

#include "Headers/idt.hpp"
void testMapDistance() {
    mvox::Cube cube; cube.width = cube.height = cube.depth = 3; cube.Format = mvox::PixelFormat::sY2;
    size_t size = cube.size(); 
    int ind = cube.IJK2lin(1,1,1), ind1=cube.IJK2lin(0,1,1), ind2=cube.IJK2lin(1,0,1), ind3=cube.IJK2lin(1,1,0);
    int ind4=cube.IJK2lin(2,1,1), ind5=cube.IJK2lin(1,2,1), ind6=cube.IJK2lin(1,1,2);

    printf("size=%d ind=%d\n",(int)size,ind);
    cube.Data = new char[size];
    short *data = (short *)cube.Data;
    for(int i =0; i<27; i++) data[i] = 0;
    data[ind] = 35; data[ind1] = 35; data[ind2] = 35; data[ind3] = 35;
    data[ind4] = 35; data[ind5] = 35; data[ind6] = 35;

    unsigned long long dims[] = {3,3,3};
    double vsize[] = {1,1,1};

    IDT idt(data,34,34,-1,dims,vsize,ind);
    printf("mask=%p\n",idt.mask);
    for(int i =0; i<27; i++) 
        printf("%d ",idt.distanceMap[i]);
    printf("\n");
}

int main() {

    // Pochukaeva(); return 0;
    //testMapDistance(); return 0;

    char buf[256]={'C','W','D','='}; getcwd(buf+4,sizeof(buf)-4); tracer.log(buf);

    // 1-й уровень защиты - вытеснение. Если обнаружен другой экземпляр ATB, то запущенный вытесняет текущий
    // это сработает только если новый экземпляр запущен в том же справочникке
    FILE *pidfd = fopen("pid.atb","r");
    if(pidfd) {
        char buf[16];
        fgets(buf,sizeof(buf),pidfd);
        pid_t pid = atoi(buf);
        fclose(pidfd);
        if(pid != 0) {
            tracer.log(string("Посылаю SIGTERM процессу atb pid=")+std::to_string(pid));
            kill(pid,SIGTERM);      
            sleep(1);    
        }
    }
    pidfd = fopen("pid.atb","w");
    if(!pidfd) {
        tracer.log("не могу открыть на запись файл pid.atb..exiting");
        exit(0);
    }
    pid_t mypid = getpid();
    fprintf(pidfd,"%d",mypid);
    fclose(pidfd);

    
    void LWSservice(); LWSservice();
//    void test_timing_zero_mem(); test_timing_zero_mem();
//    void test_computeROI(); test_computeROI();
//    void test_computeROI_1(); test_computeROI_1();

//    void cube_test_2(); cube_test_2();
//    void cube_test_3(); cube_test_3();
    //void t_nonzero(); t_nonzero();
//    Pochukaeva();
//    Tomsk();
//    cmp_Tomsk();

    //testDicomDirReader(dir);
    //cube_test_1(cube);


    return 0;
}


void cube_test_2() {
    tracer.startInterval("cube_test_2");
    mvox::Cube cube;
    cube.width = 512; cube.height = 512; cube.depth = 113;
    size_t len = cube.width * cube.height * cube.depth;
    cube.Format = mvox::PixelFormat::Y;
    string datfile = "/mnt/d/Users/german/Desktop/V5/Тимур/MultiVox/Bin/ffr-aorta-mask-pochukaeva-113.dat";
    if(!read_cube(cube,datfile)) return;
    // пробежимся по вокселям с кодом 10 и определим кубик, который они занимают
    int x0=512,x1=-512,y0=512,y1=-512,z0=512,z1=-512, total=0, ijk[3];
    char *data = (char *)cube.Data;
    for(int i=0; i<len; i++) {
        if(data[i] != 10) continue;
        cube.lin2IJK(i,ijk);
        total++;
        if(ijk[0]<x0) x0=ijk[0]; if(ijk[0]>x1) x1=ijk[0];
        if(ijk[1]<y0) y0=ijk[1]; if(ijk[1]>y1) y1=ijk[1];
        if(ijk[2]<z0) z0=ijk[2]; if(ijk[2]>z1) z1=ijk[2];
    }
    cout << total <<' '<<x0<<' '<<x1<<' '<<y0<<' '<<y1<<' '<<z0<<' '<<z1<<' '<<endl;
    tracer.logInterval("cube_test_2");
}

/* Это эксперименты над Почукаева-449. Меня интересует как долго занимает вычисление гессиана и
 * всякие другие вопросы. Кроме того интересно поэкспериментировать с распараллеливанием
 * вычислений. У Романа задействован OpenMP, надо посмотреть, дает ли это какой-то результат
 */
void cube_test_3() {
    mvox::Cube cube;
    cube.width = 512; cube.height = 512; cube.depth = 113;
//    size_t len = cube.width * cube.height * cube.depth;
    cube.Format = mvox::PixelFormat::sY2;
    string datfile = "/mnt/d/xampp/htdocs/V5-FFR/ffr-cube-pochukaeva-113.bin";
    tracer.startInterval("Почукаева-449");
    bool res = read_cube(cube,datfile);
    tracer.logInterval("Почукаева-449");
    cout << "**Почукаева-449 read_cube takes " << tracer.getInterval("Почукаева-449") << endl;
}

#include <string.h>     // memset
#include <strings.h>    // bzero
void test_timing_zero_mem() {
    // filing 50000000 chars:0.443
    int len = 50000000;
    char * data = new char[len];
    tracer.startInterval("filing 50000000 chars");
    for(int i=0; i<len; i++)
        data[i] = 0;
    tracer.logInterval("filing 50000000 chars");
    delete[] data;

    // filing 50000000 int:0.469
    int * data1 = new int[len];
    tracer.startInterval("filing 50000000 int");
    for(int i=0; i<len; i++)
        data1[i] = 0;
    tracer.logInterval("filing 50000000 int");
    delete[] data1;

    // filing 50000000 long:0.589
    long * data2 = new long[len];
    tracer.startInterval("filing 50000000 long");
    for(int i=0; i<len; i++)
        data2[i] = 0;
    tracer.logInterval("filing 50000000 long");
    delete[] data2;

    // memset 50000000 bytes:0.014 (0.011)
    char * data3 = new char[len];
    tracer.startInterval("memset 50000000 bytes");
    memset(data3,0,len);
    tracer.logInterval("memset 50000000 bytes");
    delete[] data3;

    // bzero 50000000 bytes:0.015 (0.014)
    char * data4 = new char[len];
    tracer.startInterval("bzero 50000000 bytes");
    bzero(data4,len);
    tracer.logInterval("bzero 50000000 bytes");
    delete[] data4;

    // filling 50000000 doubles:0.871
    double * data5 = new double[len];
    tracer.startInterval("filling 50000000 doubles");
//    bzero(data4,len);
    for(int i=0; i<len; i++) data5[i] = 0;
    tracer.logInterval("filling 50000000 doubles");
    delete[] data5;

    // for vs memcpy
    char *d6 = new char[len], *d7 = new char[len];
    tracer.startInterval("copying 50000000 chars");
    for(int i=0; i<len; i++) d6[i] = d7[i];
    tracer.logInterval("copying 50000000 chars");
    delete[] d6; delete[] d7;

    char *d8 = new char[len], *d9 = new char[len];
    tracer.startInterval("memcpy 50000000 chars");
    memcpy(d9,d8,len);
    tracer.logInterval("memcpy 50000000 chars");
    delete[] d8; delete[] d9;

}

void test_computeROI() {
    int w=512,h=512,d=193, len=w*h*d; size_t s =0;
    mvox::Cube cube; cube.width = w; cube.height = h; cube.depth = d;
    cube.Format = mvox::PixelFormat::Y;
    cube.Data = new char[len];
    char *data = (char *)cube.Data;
    memset(data,1,len);
//    memset(data+1000000,1,368000);  // это имитация Колмыкова
    int ROI[6]={0};

    tracer.startInterval("computeROI");
    // computeROI:7.08 на полном кубе
    cube.computeROI(ROI);
    tracer.logInterval("computeROI");

    cout << "ROI "<<ROI[0]<<' '<<ROI[1]<<' '<<ROI[2]<<' '<<ROI[3]<<' '<<ROI[4]<<' '<<ROI[5]<<' '<<endl;
}

void test_computeROI_1() {
    int w=512,h=512,d=193, len=w*h*d;
    mvox::Cube cube; cube.width = w; cube.height = h; cube.depth = d;
    cube.Format = mvox::PixelFormat::Y;
    cube.Data = new char[len];
    unsigned char *data = (unsigned char *)cube.Data;
    memset(data,1,len);
//    memset(data+1000000,1,368000);  // это имитация Колмыкова
    int ROI[6]={0};

    tracer.startInterval("computeROI");
    //---------------------------------
    ROI[0]=w;ROI[2]=h; ROI[4]=d; ROI[1]=ROI[3]=ROI[5]=0;
    int wh = w*h;

    for(int k=0; k<d; k++) {
//        int koff = k*wh;
        for(int j=0; j<h; j++) {
//            int joff = j*w;
            for(int i=0; i<w; i++)
             {
//                if(!data[(i+joff+koff)]) continue;
                if(!data[cube.IJK2lin(i,j,k)]) continue;
                if(ROI[0] > i) ROI[0] = i;
                if(ROI[1] < i) ROI[1] = i;
                if(ROI[2] > j) ROI[2] = j;
                if(ROI[3] < j) ROI[3] = j;
                if(ROI[4] > k) ROI[4] = k;
                if(ROI[5] < k) ROI[5] = k;
            }
        }
    }
    //-------------------------------
    tracer.logInterval("computeROI");

    cout << "ROI "<<ROI[0]<<' '<<ROI[1]<<' '<<ROI[2]<<' '<<ROI[3]<<' '<<ROI[4]<<' '<<ROI[5]<<' '<<endl;
}

//    for(int i=0; i<w; i++)
//        for(int j=0; j<h; j++)
//            for(int k=0; k<d; k++)
//                s += cube.IJK2lin(i,j,k);

