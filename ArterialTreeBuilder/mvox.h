#ifndef MVOX_H
#define MVOX_H
#pragma region MVOX

namespace mvox
{
	enum PixelFormat {
		Y,
		sY2,
		Y2,
		YF,
		BGR,
		BGRA
	};

	class PixelFormatUtils {
	public:
		static int PixelFormatBytesPerPixel(PixelFormat fmt) {
			switch (fmt) {
				case PixelFormat::Y:
					return 1;
				case PixelFormat::Y2:
				case PixelFormat::sY2:
					return 2;
				case PixelFormat::YF:
					return sizeof(float);
				case PixelFormat::BGR:
					return 3;
				case PixelFormat::BGRA:
					return 4;
				default:
					throw 0;
			}
		}
	};

	template<typename T>
	struct Matrix4x4;

	template<class T>
	struct Point3D {
	public:
		T x;
		T y;
		T z;

		Point3D<T>() {
		}

		Point3D<T>(T x, T y, T z) {
			this->x = x;
			this->y = y;
			this->z = z;
		}

		Point3D<T> operator +(Point3D<T> p2) {
			Point3D<T> r = *this;
			r.x += p2.x;
			r.y += p2.y;
			r.z += p2.z;
			return r;
		}

		Point3D<T> operator *(float scale) {
			return Point3D<T>(x * scale, y * scale, z * scale);
		}

		double Length() {
			return sqrt(x * x + y * y + z * z);
		}

		template<typename TM>
		Point3D<T> operator *(Matrix4x4<TM>& m) {
			Point3D<T> v = *this;
			T f = v.x * m.M14 + v.y * m.M24 + v.z * m.M34 + 1 * m.M44;
			if (f != 1 && f != 0)
				return Point3D<T>((v.x * m.M11 + v.y * m.M21 + v.z * m.M31 + m.M41) / f,
				(v.x * m.M12 + v.y * m.M22 + v.z * m.M32 + m.M42) / f,
				(v.x * m.M13 + v.y * m.M23 + v.z * m.M33 + m.M43) / f);
			else
				return Point3D<T>(v.x * m.M11 + v.y * m.M21 + v.z * m.M31 + m.M41,
					v.x * m.M12 + v.y * m.M22 + v.z * m.M32 + m.M42,
					v.x * m.M13 + v.y * m.M23 + v.z * m.M33 + m.M43);
		}


		Point3D<T> operator -(Point3D<T> p2) {
			Point3D<T> r = *this;
			r.x -= p2.x;
			r.y -= p2.y;
			r.z -= p2.z;
			return r;
		}

        inline bool operator== (const Point3D& param) const {
			return !(*this != param);
		}

        inline bool operator!= (const Point3D& param) const {
			return x != param.x || y != param.y || z != param.z;
		}

		T SquareDistanceTo(Point3D<T> p) {
			return (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) + (z - p.z) * (z - p.z);
		}
	};



	template<typename T>
	inline T Dot(Point3D<T> p1, Point3D<T> p2) {
		return (p1.x * p2.x) + (p1.y * p2.y) + (p1.z * p2.z);
	}

	typedef Point3D<int> Point3D_Int;
	typedef Point3D<unsigned short> Point3D_UShort;
	typedef Point3D<short> Point3D_Short;
	typedef Point3D<float> Point3D_Float;
	typedef Point3D<double> Point3D_Double;

	template<typename TFormat>
	struct Matrix4x4 {
	public:
		TFormat M11;
		TFormat M12;
		TFormat M13;
		TFormat M14;

		TFormat M21;
		TFormat M22;
		TFormat M23;
		TFormat M24;

		TFormat M31;
		TFormat M32;
		TFormat M33;
		TFormat M34;

		TFormat M41;
		TFormat M42;
		TFormat M43;
		TFormat M44;
	};

	typedef Matrix4x4<float> Matrix4x4_Float;
	typedef Matrix4x4<double> Matrix4x4_Double;

	struct Cube {
	public:
		void* Data;
		PixelFormat Format;
		int width;
		int height;
		int depth;

		float scaleX;
		float scaleY;
		float scaleZ;

		Matrix4x4<float> ImageToSpace;
		Matrix4x4<float> SpaceToImage;

		template<typename T>
		inline T* GetData() {
			return (T*)Data;
		}

		template<typename T>
		inline T* GetSlice(int slice) {
			int offset = slice * PixelFormatUtils::PixelFormatBytesPerPixel(Format) * width * height;
			return (T*)((char*)Data + offset);
		}

		// это работает только для Y, sY2, YF, для типов у которых есть sizeof(T)
		template<typename T>
		inline T GetValue(int x, int y, int z) {
			return ((T*)Data)[z * width * height + y * width + x];
		}

                size_t size() {
                    return width*height*depth * PixelFormatUtils::PixelFormatBytesPerPixel(Format);
                }

                // вычислить ROI (Region Of Interest) данного куба, то есть область где находятся
                // ненулевые воксели. ROI вычисляется только для кубов формата Y.
                // ROI[6] - xmin,xmax,ymin,ymax,zmin,zmax
                // возврат - число единиц в ROI
                int computeROI(int ROI[6]) {
                    ROI[0]=width;ROI[2]=height; ROI[4]=depth;
                    ROI[1]=ROI[3]=ROI[5]=0;
                    if(Format != mvox::PixelFormat::Y) return 0;
                    int wh = width*height, ones = 0;

                    unsigned char *data = (unsigned char *)Data;
                    for(int k=0, koff=0; k<depth; k++, koff+=wh)
                        for(int j=0, joff=0; j<height; j++,joff+=width)
                            for(int i=0; i<width; i++) {
                                if(!data[i+joff+koff]) continue;
                                ones++;

                                if(ROI[0] > i) ROI[0] = i;
                                if(ROI[1] < i) ROI[1] = i;
                                if(ROI[2] > j) ROI[2] = j;
                                if(ROI[3] < j) ROI[3] = j;
                                if(ROI[4] > k) ROI[4] = k;
                                if(ROI[5] < k) ROI[5] = k;
                            }
                    return ones;
                }

                inline int IJK2lin(int i, int j, int k) {
                    return (i+j*width+k*width*height);
                }

                inline void lin2IJK(int i, int IJK[])
                {
                    IJK[0] = (i % width );
                    IJK[1] = (i / width % height);
                    IJK[2] = (i / width / height);
                }
        };

	inline Point3D_Int CubeSize(Cube& cube) {
		return Point3D_Int(cube.width, cube.height, cube.depth);
	}



	//relativeProgress - от 0 до 1.0f включительно
    typedef void(*UpdateProgress)(float relativeProgress, const wchar_t* status);
}

#pragma warning( disable : 4297 4996 )


struct FFRSettings {
public:
        mvox::Point3D_Double AortaInitialPoint;
        double AortaRadius;
        double AortaAverageIntensity;
        double idtStopParameter; ///< Stop parameter for IDT
        int aortaThreshold; ///< Intensity threshold for segmentation of initial mask of IDT
        unsigned maxNoiseLength; ///< Maximum length of false twig
        double frangiThreshold; ///< Thresholding parameter for Frangi Vesselness
        unsigned minDistBetweenOstia; ///< Minimum distance between ostia points of coronary arteries
        unsigned minNumOfVoxelsInBranch;
};

struct VesselInfo {
public:
        int CenterLineCount;
        int BifurcationCount;
        std::wstring VesselName;
};

enum StenosisType {
        Stenosis = 0,
        Stent = 1,
        Flow3D = 2
};

struct CrossInfo {
public:
        mvox::Point3D_Double Position;
        double Area;
};

struct FFRStenosis {
public:
        int Id;
    ::StenosisType StenosisType;

        CrossInfo Center;
        CrossInfo Front;
        CrossInfo Rear;

        int UserStenosisPercent;
};

struct VesselsSegmParameters {
public:
        double AortaTau;
        double Alpha;
        double Beta;
        double Gamma;
};


struct CompleteParameters {
public:
        VesselsSegmParameters VesselParameters;
        double VesselsThreshold;
};


#pragma endregion

#endif // MVOX_H
