cmake_minimum_required(VERSION 3.9)
project(ArterialTreeBuilder)

set(CMAKE_FIND_LIBRARY_SUFFIXES ".a")
set(BUILD_SHARED_LIBS OFF)
set(CMAKE_EXE_LINKER_FLAGS "-static")

find_package(ITK REQUIRED)
include(${ITK_USE_FILE})

find_package(OpenMP REQUIRED)

list(APPEND SRC ArterialTreeBuilder.cpp eigen.cpp graph.cpp)
list(APPEND SRC hessian2d3d.cpp hessian_filters.cpp idt.cpp imgaussian.cpp)
list(APPEND SRC stdafx.cpp thinner.cpp utils.cpp vtb.cpp)
list(APPEND SRC tracer.cpp main.cpp lws.cpp ffrservice.cpp)
include_directories(.)
include_directories(Headers)
include_directories(Headers/lws/unix/include)

add_executable(atb ${SRC})
target_link_libraries(atb ${ITK_LIBRARIES} -lwebsockets OpenMP::OpenMP_CXX)
