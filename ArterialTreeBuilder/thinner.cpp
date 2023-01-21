#include "stdafx.h"
#include "thinner.hpp"
#include "utils.h"
#include <queue>
#include <array>

#include "configuration.h"

// #define PRINT_LOG;
//#define CEREBRAL_VESSELS



using namespace std;

Thinner::Thinner(short* _Z, unsigned long long *_dim, double *vsize_)
{
  leftOstiaNodeID=rightOstiaNodeID=-1;
  leftOstiaRibID=rightOstiaRibID=-1;

  unsigned long long i;
  graphNodesCount = 0;
  max_dmap_val = 0;

  Z = nullptr;
  dmap = nullptr;

  dim[0] = _dim[0]+2;
  dim[1] = _dim[1]+2;
  dim[2] = _dim[2]+2;

  vsize[0] = vsize_[0];
  vsize[1] = vsize_[1];
  vsize[2] = vsize_[2];

  n = dim[0]*dim[1]*dim[2];

  //TODO добавить возможность обрезки изображения, чтобы Z содержало лишь изображение + слой нулевых вокселей
  try {
	  Z = new int[n];
  }
  catch (std::bad_alloc) {
      throw std::runtime_error("Bad alloc Thinner.Z");
  }

  for (i=0; i<n; ++i)
    Z[i]=0;
  for (unsigned x=0; x<dim[0]-2; ++x)
    for (unsigned y=0; y<dim[1]-2; ++y)
      for (unsigned z=0; z<dim[2]-2; ++z) {
        i = (unsigned long long)x + _dim[0]*
           ((unsigned long long)y + _dim[1]*(unsigned long long)z);
        Z[getIndex(x+1,y+1,z+1)] = (_Z[i]==0? 0 : 1);
      }
  getN26();
  getN18();
  getN6();
}


Thinner::~Thinner()
{
  if (Z != nullptr) { delete[] Z; Z = nullptr; }
  if (dmap != nullptr) { delete[] dmap; dmap = nullptr; }
  N26.clear();
  N18.clear();
  N6.clear();
  SkeletalSegments.clear();
  VoxelNodes.clear();
  FreneFrames.clear();
}


void Thinner::mainAlgorithm()
{
	unsigned long long ox, oy, oz;
	ofstream o;
	o.open("log_thinner_main_alg.txt");
	o << "leftOstiaID " << leftOstiaID << endl;
	if (leftOstiaID > -1) {
		ox = leftOstiaID % (dim[0] - 2);
		oy = (leftOstiaID / (dim[0] - 2)) % (dim[1] - 2);
		oz = leftOstiaID / ((dim[1] - 2)* (dim[0] - 2));
		leftThinnerOstiaInd = getIndex(ox + 1, oy + 1, oz + 1);
		o << "leftThinnerOstiaInd " << leftThinnerOstiaInd  << "computed "<< endl;
	} else
		leftThinnerOstiaInd = -1;
	o << "rightOstiaID " << rightOstiaID << endl;

	if (rightOstiaID > -1) {
		ox = rightOstiaID % (dim[0] - 2);
		oy = (rightOstiaID / (dim[0] - 2)) % (dim[1] - 2);
		oz = rightOstiaID / ((dim[1] - 2)* (dim[0] - 2));
		rightThinnerOstiaInd = getIndex(ox + 1, oy + 1, oz + 1);
		o << "rightThinnerOstiaInd " << rightThinnerOstiaInd << "computed " << endl;
	} else
		rightThinnerOstiaInd = -1;
	o.close();
#ifndef CEREBRAL_VESSELS
	removeBorderCycles();
#endif //CEREBRAL_VESSELS

  distanceTransform();
  Thinning1 (7);
  
  newBuildTree (maxNoiseLength);

  //removeGaps();  
  //newGlueSegmentsToBranches();
}


unsigned long long Thinner::getIndex(unsigned x, unsigned y, unsigned z)
{
  return (unsigned long long)x + dim[0] *
         ( (unsigned long long)y + dim[1] *
           (unsigned long long)z );
}


void Thinner::getCoords(unsigned outputCoords[3], unsigned long long inputIndex) {
  outputCoords[0] = inputIndex % dim[0];
  outputCoords[1] = inputIndex / dim[0] % dim[1];
  outputCoords[2] = inputIndex / dim[0] / dim[1];
  return;
}

void Thinner::getN26()
{
  N26.clear();
  vector<int> coord(3,0);
  for (int i=-1; i<2; ++i)
    for (int ii=-1; ii<2; ++ii)
      for (int iii=-1; iii<2; ++iii)
      {
        int s = abs(i) + abs(ii) + abs(iii);
        if (s>0)
        {
          coord[0] = i;
          coord[1] = ii;
          coord[2] = iii;
          N26.push_back(coord);
        }
      }
}

int Thinner::getVoxelNodeComponentID(int x, int y, int z) {
  return Z[getIndex(x,y,z)]-4;
}

void Thinner::getN18()
{
  N18.clear();
  vector<int> coord(3,0);
  for (int i=-1; i<2; ++i)
    for (int ii=-1; ii<2; ++ii)
      for (int iii=-1; iii<2; ++iii)
      {
        int s = abs(i) + abs(ii) + abs(iii);
        if (s==1 || s==2)
        {
          coord[0] = i;
          coord[1] = ii;
          coord[2] = iii;
          N18.push_back(coord);
        }
      }
}


void Thinner::getN6()
{
  N6.clear();
  vector<int> coord(3,0);
  for (int i=-1; i<2; ++i)
    for (int ii=-1; ii<2; ++ii)
      for (int iii=-1; iii<2; ++iii)
      {
        int s = abs(i) + abs(ii) + abs(iii);
        if (s==1)
        {
          coord[0] = i;
          coord[1] = ii;
          coord[2] = iii;
          N6.push_back(coord);
        }
      }
}


void Thinner::initForeground()
{
  unsigned x, y, z;
  Foreground.clear();
  vector<int> coord(3,0);

  for (z=1; z<dim[2]-1; ++z)
    for (y=1; y<dim[1]-1; ++y)
      for (x=1; x<dim[0]-1; ++x)
        if (Z[getIndex(x,y,z)] > 0)
        {
          coord[0] = x;
          coord[1] = y;
          coord[2] = z;
          Foreground.push_back(coord);
        }
}


void Thinner::findBorder()
{
  Border.clear();
  vector<int> coord(3,0);
  for (unsigned long long i=0; i<Foreground.size(); ++i)
  {
    for (int j=0; j<26; ++j)
    {
      coord[0] = Foreground[i][0] + N26[j][0];
      coord[1] = Foreground[i][1] + N26[j][1];
      coord[2] = Foreground[i][2] + N26[j][2];
      if (Z[getIndex (coord[0], coord[1], coord[2])] == 0)
      {
        Border.push_back(Foreground[i]);
        break;
      }
    }
  }
}


int Thinner::D (vector<int> p1,vector<int> p2)
{
  int norm = (p1[0] - p2[0]) * (p1[0] - p2[0])
           + (p1[1] - p2[1]) * (p1[1] - p2[1])
           + (p1[2] - p2[2]) * (p1[2] - p2[2]);
  if (norm == 1)
    return 3;
  if (norm == 2)
    return 4;
  if (norm == 3)
    return 5;
  else
    return 0;
}


int Thinner::d(vector<int> point)
{
  vector<int> neighb(3,0);
  int min_dist = -1;
  int temp, d2;
  for (int i=0; i<26; ++i)
  {
    neighb = point;
    neighb[0] += N26[i][0];
    neighb[1] += N26[i][1];
    neighb[2] += N26[i][2];
    //d2 = dmap[neighb[0] + dim[0]*(neighb[1]+ dim[1]*neighb[2])];
    d2 = dmap[getIndex (neighb[0], neighb[1], neighb[2])];
    if (d2!=1)
    {
      temp = d2 + D(neighb, point);
      if (min_dist == -1 || min_dist > temp)
        min_dist = temp;
    }
  }
  return min_dist;
}


void Thinner::distanceTransform()
{
  unsigned long long i, x, y, z;
  if (dmap != nullptr) { delete[] dmap; dmap = 0; }
  try {
	  dmap = new int[n];
  }
  catch (std::bad_alloc) {
      throw std::runtime_error("Bad alloc Thinner.dmap");
  }

  unsigned int inf = 2*min( min(dim[0],dim[1]), dim[2]);

  vector<int> point(3);
  vector<queue<vector<int> > > Queues(inf+1);

  for (i=0; i<n; ++i)
    dmap[i] = 0;
  Foreground.clear();
  for (z=1; z<dim[2]-1; ++z)
    for (y=1; y<dim[1]-1; ++y)
      for (x=1; x<dim[0]-1; ++x)
        if (Z[x+dim[0]*(y+dim[1]*z)] == 1)
        {
          point[0] = x;
          point[1] = y;
          point[2] = z;
          dmap[x + dim[0] * (y + dim[1] * z)] = inf;
          Foreground.push_back(point);
	}

  vector<vector<int> >::iterator it;

  findBorder();
  vector<int> neighb(3);

  int count = 0;
  for (it=Border.begin(); it!=Border.end(); ++it)
    for (i=0; i<6; ++i)
    {
      neighb[0] = (*it)[0] + N6[i][0];
      neighb[1] = (*it)[1] + N6[i][1];
      neighb[2] = (*it)[2] + N6[i][2];
      if (dmap[getIndex (neighb[0], neighb[1], neighb[2])] == 0)
      {
        ++count;
        Queues[3].push((*it));
        dmap[getIndex ((*it)[0], (*it)[1], (*it)[2])] = 3;
        break;
      }
  }

  for (it=Border.begin(); it!=Border.end(); ++it)
    if ( dmap[getIndex ((*it)[0], (*it)[1], (*it)[2])] > 4)
      for (i=0; i<18; ++i)
      {
        neighb[0] = (*it)[0] + N18[i][0];
        neighb[1] = (*it)[1] + N18[i][1];
        neighb[2] = (*it)[2] + N18[i][2];
        if (dmap[getIndex (neighb[0], neighb[1], neighb[2])] == 0)
        {
          Queues[4].push((*it));
          dmap[getIndex ((*it)[0], (*it)[1], (*it)[2])] = 4;
          break;
        }
      }

  for (it=Border.begin(); it!=Border.end(); ++it)
    if ( dmap[getIndex ((*it)[0], (*it)[1], (*it)[2])] > 5)
      for (i=0; i<26; ++i)
      {
        neighb[0] = (*it)[0] + N26[i][0];
        neighb[1] = (*it)[1] + N26[i][1];
        neighb[2] = (*it)[2] + N26[i][2];
        if (dmap[getIndex (neighb[0], neighb[1], neighb[2])] == 0)
        {
          Queues[5].push((*it));
          dmap[getIndex ((*it)[0], (*it)[1], (*it)[2])] = 5;
          break;
        }
      }

  for (i=3; i<inf+1; ++i)
    while (!Queues[i].empty())
    {
      point = Queues[i].front();
      Queues[i].pop();
      for (int j=0; j<26; ++j)
      {
        neighb[0] = point[0] + N26[j][0];
        neighb[1] = point[1] + N26[j][1];
        neighb[2] = point[2] + N26[j][2];
        int distance = dmap[getIndex (point[0], point[1], point[2])] + D(neighb,point);
        if (distance < dmap[getIndex (neighb[0], neighb[1], neighb[2])])
        {
          dmap[getIndex (neighb[0], neighb[1], neighb[2])] = distance;
          Queues[distance].push(neighb);
        }
      }
    }
    Border.clear();
    Queues.clear();
}


bool Thinner::adjacentToComponent (vector<int> p,
                                   set<vector<int> > component,
                                   int adj)
{
  set<vector<int> >::iterator it;
  for (it=component.begin(); it!=component.end(); ++it)
    if ( adj >= (p[0] - (*it)[0]) * (p[0] - (*it)[0])
              + (p[1] - (*it)[1]) * (p[1] - (*it)[1])
              + (p[2] - (*it)[2]) * (p[2] - (*it)[2]) )
      return 1;
  return 0;
}


bool Thinner::isSimple(vector<int> point)
{
  set<vector<int> > fnp;
  set<vector<int> > bnp;
  set<vector<int> > component;

  vector<int> coord(3,0);
  set<vector<int> >::iterator it;
  /*======================*/
  /* Foreground Component */
  /*======================*/
  for (int i = 0; i<26; ++i)
  {
    coord[0] = point[0] + N26[i][0];
    coord[1] = point[1] + N26[i][1];
    coord[2] = point[2] + N26[i][2];
    if (Z[ getIndex (coord[0], coord[1], coord[2] ) ] > 0)
      fnp.insert(coord);
  }
  component.clear();
  if (!fnp.empty())
  {
    int changes = 1;
    coord = (*fnp.begin());
    fnp.erase(fnp.begin());
    component.insert(coord);
    while (changes)
    {
      changes = 0;
      for(it=fnp.begin(); it!=fnp.end(); )
      {
        if (adjacentToComponent((*it), component, 3))
        {
          changes = 1;
          component.insert(*it);
          fnp.erase(it++);
        }
        else
          it ++;
      }
    }
    if (!fnp.empty())
      return 0;
  }
  else
    return 0;
  /*======================*/
  /* Background Component */
  /*======================*/
  for (int i=0; i<18; ++i)
  {
    coord[0] = point[0] + N18[i][0];
    coord[1] = point[1] + N18[i][1];
    coord[2] = point[2] + N18[i][2];
    if (Z[ getIndex (coord[0], coord[1], coord[2] ) ] == 0)
      bnp.insert(coord);
  }

  component.clear();
  bool flag = 0;
  for (int i=0; i<6; ++i)
  {
    coord[0] = point[0] + N6[i][0];
    coord[1] = point[1] + N6[i][1];
    coord[2] = point[2] + N6[i][2];
    if (bnp.find(coord)!=bnp.end())
    {
      flag = 1;
      int changes = 1;
      component.insert(coord);
      bnp.erase(coord);
      while (changes)
      {
        changes = 0;
        for (it=bnp.begin(); it!=bnp.end(); )
        {
          if (adjacentToComponent((*it), component, 1))
          {
            component.insert((*it));
            changes = 1;
            bnp.erase(it++);
          }
          else
            it ++;
        }
      }
      for (int j=i+1; j<6; ++j)
      {
        coord[0]= point[0]+N6[j][0];
        coord[1]= point[1]+N6[j][1];
        coord[2]= point[2]+N6[j][2];
        if (bnp.find(coord)!=bnp.end())
        return 0;
      }
      break;
    }
  }

  if (flag == 0)
    return 0;
  return 1;
}


void Thinner::removeBorderCycles()
{
  vector<int> coord(3);
  vector<vector<int> >::iterator it;
  
  for (int ii=0; ii<1; ++ii)
  {
    initForeground();
    findBorder();

    for (it=Border.begin(); it!=Border.end(); ++it)
    {
      for (int i=0; i<26; ++i)
      {
        coord = (*it);
        coord[0] += N26[i][0];
        coord[1] += N26[i][1];
        coord[2] += N26[i][2];
        Z[ getIndex (coord[0], coord[1], coord[2]) ] = 1;
      }
    }
  }
/*
  initForeground();
  Border.clear();
  for (i=0; i<Foreground.size(); ++i)
  {
    for (int j=0; j<6; ++j)
    {
      coord[0] = Foreground[i][0] + N6[j][0];
      coord[1] = Foreground[i][1] + N6[j][1];
      coord[2] = Foreground[i][2] + N6[j][2];
      if (Z[getIndex (coord[0], coord[1], coord[2])] == 0)
      {
        Border.push_back(Foreground[i]);
        break;
      }
    }
  }
  for (it=Border.begin(); it!=Border.end(); ++it)
  {
    for (int i=0; i<6; ++i)
    {
      coord = (*it);
      coord[0] += N6[i][0];
      coord[1] += N6[i][1];
      coord[2] += N6[i][2];
      Z[ getIndex (coord[0], coord[1], coord[2]) ] = 1;
    }
  }

  initForeground();
  Border.clear();
  for (i=0; i<Foreground.size(); ++i)
  {
    for (int j=0; j<6; ++j)
    {
      coord[0] = Foreground[i][0] + N6[j][0];
      coord[1] = Foreground[i][1] + N6[j][1];
      coord[2] = Foreground[i][2] + N6[j][2];
      if (Z[getIndex (coord[0], coord[1], coord[2])] == 0)
      {
        Border.push_back(Foreground[i]);
        break;
      }
    }
  }
*/
  for (int ii=0; ii<1; ++ii)
  {
    initForeground();
    findBorder();
    for (it=Border.begin(); it!=Border.end(); ++it)
      Z[getIndex( (*it)[0], (*it)[1], (*it)[2])] = 0;
  }
}


bool Thinner::isEndPoint(vector<int> point)
{
  int count = 0;
  vector<int> coord(3);
  
  if (getIndex (point[0], point[1], point[2]) == leftThinnerOstiaInd || 
      getIndex (point[0], point[1], point[2]) == rightThinnerOstiaInd)
    return 1;

  for (int i=0; i<26; ++i)
  {
    coord = point;
    coord[0] += N26[i][0];
    coord[1] += N26[i][1];
    coord[2] += N26[i][2];
    if (Z[ getIndex (coord[0], coord[1], coord[2] ) ] > 0)
      ++count;
  }
  if (count < 2)
    return 1;
  return 0;
}


bool Thinner::isCenterOfMaxBall (vector<int> point, int threshold)
{
  int dist = dmap[ getIndex (point[0], point[1], point[2])];
  if (dist < threshold)
    return 0;
  vector<int> coord(3);
  for (int i=0; i<26; ++i)
  {
    coord = point;
    coord[0] += N26[i][0];
    coord[1] += N26[i][1];
    coord[2] += N26[i][2];
//    if (dist == dmap[getIndex (coord[0], coord[1], coord[2])] - D(point, coord))
    if (dist < dmap[ getIndex (coord[0], coord[1], coord[2])])
      return 0;
  }
  return 1;
}


bool Thinner::isEdgePoint(vector<int> point, int threshold)
{
  if (threshold > dmap[getIndex(point[0],point[1],point[2])])
    return 0;
  vector<int> coord;
  int s1,s2,s3,s4,s5,s6,s7,s8,s9;
  s1=s2=s3=s4=s5=s6=s7=s8=s9=0;

  if (Z[getIndex(point[0]-1, point[1]-1, point[2]-1)] == 1) {++s5; ++s7; ++s8;}
  if (Z[getIndex(point[0]  , point[1]-1, point[2]-1)] == 1) {++s3; ++s8;}
  if (Z[getIndex(point[0]+1, point[1]-1, point[2]-1)] == 1) {++s4; ++s6; ++s8;}

  if (Z[getIndex(point[0]-1, point[1], point[2]-1)] == 1) {++s2; ++s7;}
  if (Z[getIndex(point[0]  , point[1], point[2]-1)] == 1) {++s2; ++s3; ++s4; ++s5;}
  if (Z[getIndex(point[0]+1, point[1], point[2]-1)] == 1) {++s2; ++s6;}

  if (Z[getIndex(point[0]-1, point[1]+1, point[2]-1)] == 1) {++s4; ++s7; ++s9;}
  if (Z[getIndex(point[0]  , point[1]+1, point[2]-1)] == 1) {++s3; ++s9;}
  if (Z[getIndex(point[0]+1, point[1]+1, point[2]-1)] == 1) {++s5; ++s6; ++s9;}

  if (Z[getIndex(point[0]-1, point[1]-1, point[2])] == 1) {++s1; ++s5;}
  if (Z[getIndex(point[0]  , point[1]-1, point[2])] == 1) {++s1; ++s3; ++s6; ++s7;}
  if (Z[getIndex(point[0]+1, point[1]-1, point[2])] == 1) {++s1; ++s4;}

  if (Z[getIndex(point[0]-1, point[1], point[2])] == 1) {++s1; ++s2; ++s8; ++s9;}
  if (Z[getIndex(point[0]+1, point[1], point[2])] == 1) {++s1; ++s2; ++s8; ++s9;}

  if (Z[getIndex(point[0]-1, point[1]+1, point[2])] == 1) {++s1; ++s4;}
  if (Z[getIndex(point[0]  , point[1]+1, point[2])] == 1) {++s1; ++s3; ++s6; ++s7;}
  if (Z[getIndex(point[0]+1, point[1]+1, point[2])] == 1) {++s1; ++s5;}

  if (Z[getIndex(point[0]-1, point[1]-1, point[2]+1)] == 1) {++s5; ++s6; ++s9;}
  if (Z[getIndex(point[0]  , point[1]-1, point[2]+1)] == 1) {++s3; ++s9;}
  if (Z[getIndex(point[0]+1, point[1]-1, point[2]+1)] == 1) {++s4; ++s7; ++s9;}

  if (Z[getIndex(point[0]-1, point[1], point[2]+1)] == 1) {++s2; ++s6;}
  if (Z[getIndex(point[0]  , point[1], point[2]+1)] == 1) {++s2; ++s3; ++s4; ++s5;}
  if (Z[getIndex(point[0]+1, point[1], point[2]+1)] == 1) {++s2; ++s7;}

  if (Z[getIndex(point[0]-1, point[1]+1, point[2]+1)] == 1) {++s4; ++s6; ++s8;}
  if (Z[getIndex(point[0]  , point[1]+1, point[2]+1)] == 1) {++s3; ++s8;}
  if (Z[getIndex(point[0]+1, point[1]+1, point[2]+1)] == 1) {++s5; ++s7; ++s8;}

  if (s1<2 || s2<2 || s3<2 || s4<2 || s5<2
            || s6<2 || s7<2 || s8<2 || s9<2)
    return 1;
  return 0;
}


void Thinner::Thinning1(int threshold)
{
  unsigned long long i;
  vector<vector<int> > Q;
  vector<int> point(3);
  vector<int> neighb(3);
  vector<int>::iterator q_it;
  vector<vector<int> > Temp_Set;
  char *Label;
  try {
	  Label = new char[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad alloc Thinner.Label");
  }
  for (i=0; i<n; ++i)
    Label[i] = 'u';

  unsigned dist;
  initForeground();
  vector<vector<int> >::iterator it;

  for (it=Foreground.begin(); it!=Foreground.end(); ++it)
  {
    unsigned temp = dmap[ getIndex ((*it)[0], (*it)[1], (*it)[2])];
    if (temp > max_dmap_val)
      max_dmap_val = temp;
  }

  vector<queue<vector<int> > > Queues(max_dmap_val+1);
  findBorder();

  for (it=Border.begin(); it!=Border.end(); ++it)
  {
    dist = dmap[ getIndex ((*it)[0], (*it)[1], (*it)[2])];
    Queues[dist].push ((*it));
    Label[ getIndex ((*it)[0], (*it)[1], (*it)[2])] = 'q';
  }
  
  while (1)
  {
    unsigned q_num = 3;
    while ( Queues[q_num].empty() )
	  {
      ++q_num;
	    if (q_num == max_dmap_val+1)
        break;
    }
	  if (q_num == max_dmap_val+1)
      break;
    while (!Queues[q_num].empty())
    {
      point = Queues[q_num].front();
      Queues[q_num].pop();

      Label[ getIndex (point[0], point[1], point[2])] = 'u';
      if ( !isEndPoint(point))
        Temp_Set.push_back(point);
    }

    for (it=Temp_Set.begin(); it!=Temp_Set.end(); ++it)
    {
      point = *it;
      if (isSimple(point) )
      {
        Z[ getIndex (point[0],point[1], point[2])] = 0;
        for (i=0; i<26; ++i)
        {
          neighb= point;
          neighb[0] += N26[i][0];
          neighb[1] += N26[i][1];
          neighb[2] += N26[i][2];
          dist = dmap[ getIndex (neighb[0],neighb[1], neighb[2])];
          if (Z[ getIndex (neighb[0],neighb[1], neighb[2])] == 1 &&
              Label[ getIndex (neighb[0],neighb[1], neighb[2])] != 'q')
          {
            Queues[dist].push (neighb);
            Label[ getIndex (neighb[0],neighb[1], neighb[2])] = 'q';
          }
        }
      }
    }
    Temp_Set.clear();
  }
  delete[] Label;
  Thinning2(Q);
}


int Thinner::Thinning2(vector<vector<int> > SetForThinning)
{
  int num_of_deleted = 0;
  unsigned dist;
  vector<int> point(3);
  vector<int> neighb(3);
  vector<vector<int> >::iterator it;

  vector<vector<vector<int> > > Queues(max_dmap_val+1);

  if (SetForThinning.empty())
  {
    initForeground();
    for (it=Foreground.begin(); it!=Foreground.end(); ++it)
    {
      int dist = dmap[getIndex ((*it)[0], (*it)[1], (*it)[2]) ];
      Queues[dist].push_back ((*it));
    }
  }
  else
  {
    for (it=SetForThinning.begin(); it!=SetForThinning.end(); ++it)
    {
      int dist = dmap[getIndex ((*it)[0], (*it)[1], (*it)[2]) ];
      Queues[dist].push_back ((*it));
    }
  }

  while (1)
  {
    unsigned q_num = 3;
    while ( Queues[q_num].empty() )
	  {
      ++q_num;
	    if (q_num == max_dmap_val+1)
        break;
	  }
	  if (q_num == max_dmap_val+1)
      break;
    point = *(Queues[q_num].begin());
    Queues[q_num].erase (Queues[q_num].begin());
    if (! isEndPoint(point))
      if (isSimple(point) )
      {
        Z[ getIndex (point[0], point[1], point[2])] = 0;
        ++num_of_deleted;
        for (int i=0; i<26; ++i)
        {
          neighb= point;
          neighb[0] += N26[i][0];
          neighb[1] += N26[i][1];
          neighb[2] += N26[i][2];
          dist = dmap[ getIndex (neighb[0],neighb[1], neighb[2])];
          if ( find (Queues[dist].begin(), Queues[dist].end(), neighb)
                                              == Queues[dist].end() &&
              Z[ getIndex (neighb[0],neighb[1], neighb[2])] == 1)
            Queues[dist].push_back (neighb);
        }
      }
  }
  return num_of_deleted;
}


void Thinner::findVoxelNodes()
{
  int len_fnp;
  VoxelNodes.clear();
  initForeground();

  vector<vector<int> >::iterator it;
  vector<vector<int> > fnp;
  vector<int> neighb(3);

  for (it=Foreground.begin(); it!=Foreground.end(); ++it)
  {
    Z[ getIndex((*it)[0], (*it)[1], (*it)[2])] = 1;
    len_fnp = 0;
    fnp.clear();
    for(int i=0; i<26; ++i)
    {
      neighb = (*it);
      neighb[0] += N26[i][0];
      neighb[1] += N26[i][1];
      neighb[2] += N26[i][2];
      if (Z[ getIndex (neighb[0], neighb[1], neighb[2])] > 0)
      {
        fnp.push_back(neighb);
        ++len_fnp;
      }
    }
    if (len_fnp>2 || len_fnp == 1)
    {
      Z[ getIndex ((*it)[0], (*it)[1], (*it)[2]) ] = 2;
      (*it).push_back(len_fnp);
      VoxelNodes.push_back((*it));
    }
  }

  //push left ostium into VoxelNodes
  if (leftThinnerOstiaInd > -1 && Z[leftThinnerOstiaInd]!=2) {
    Z[leftThinnerOstiaInd]=2;
    vector<int> ostiaVoxel(3);
    ostiaVoxel[0] = leftThinnerOstiaInd%dim[0];
    ostiaVoxel[1] = leftThinnerOstiaInd/dim[0]%dim[1];
    ostiaVoxel[2] = leftThinnerOstiaInd/dim[0]/dim[1];
    VoxelNodes.push_back(ostiaVoxel);
  }
  //push right ostium into VoxelNodes
  if (rightThinnerOstiaInd > -1 && Z[rightThinnerOstiaInd]!=2) {
    Z[rightThinnerOstiaInd]=2;
    vector<int> ostiaVoxel(3);
    ostiaVoxel[0] = rightThinnerOstiaInd%dim[0];
    ostiaVoxel[1] = rightThinnerOstiaInd/dim[0]%dim[1];
    ostiaVoxel[2] = rightThinnerOstiaInd/dim[0]/dim[1];
    VoxelNodes.push_back(ostiaVoxel);
  }
}


void Thinner::destructToSegments()
{
  SkeletalSegments.clear();
  bool isBeginPoint;// isIsolatedNode;
  queue<vector<int> > front;
  vector<vector<int> > segment;
  vector<int> point,coord;
  vector<vector<int> >::iterator it;
  
  findVoxelNodes();
  initForeground();
  for (it=Foreground.begin(); it!=Foreground.end(); it++)
  {
    // find segment point adjacent to node
    point = *it;
    if (Z[ getIndex(point[0],point[1],point[2])] != 1)
      continue;
    isBeginPoint = 0;
    segment.clear();
    for(int j=0; j<26; ++j)
    {
      coord = point;
      coord[0] += N26[j][0];
      coord[1] += N26[j][1];
      coord[2] += N26[j][2];
      if (Z[ getIndex(coord[0], coord[1],coord[2])] == 2)
      {
        isBeginPoint = 1;
        segment.push_back(coord);
        segment.push_back(point);
        break;
      }
    }
    if (!isBeginPoint)
      continue;
    // find segment
    front.push(point);
    while (!front.empty())
    {
      point = front.front();
      front.pop();
      Z[ getIndex(point[0], point[1], point[2])] = 0;

      for(int j=0; j<26; ++j)
      {
        coord = point;
        coord[0] += N26[j][0];
        coord[1] += N26[j][1];
        coord[2] += N26[j][2];
        if (Z[ getIndex(coord[0], coord[1],coord[2])] == 1)
        {
          front.push(coord);
          segment.push_back(coord);
          break;
        }
      }
    }
    // find end of segment
    point = *(segment.end()-1);
    for(int j=0; j<26; ++j)
    {
      coord = point;
      coord[0] += N26[j][0];
      coord[1] += N26[j][1];
      coord[2] += N26[j][2];
      if (Z[ getIndex(coord[0], coord[1], coord[2])] == 2)
      {
        if (segment.size()==2 &&
              (coord[0]-segment[0][0])*(coord[0]-segment[0][0]) +
              (coord[1]-segment[0][1])*(coord[1]-segment[0][1]) +
              (coord[2]-segment[0][2])*(coord[2]-segment[0][2]) == 0)
          continue;
          // in that case segment consists of three voxels:
          // node1-inner-node2.
          // when node2 is to be found segment contains
          // only two voxels and it is need to test inequality
          // node1!=node2 
        segment.push_back(coord);
        break;
      }
    }
    SkeletalSegments.push_back(segment);
  }
  for (unsigned i=0; i<SkeletalSegments.size(); ++i)
    for (unsigned j=1; j<SkeletalSegments[i].size()-1; ++j)
      Z[ getIndex(SkeletalSegments[i][j][0], SkeletalSegments[i][j][1],
                               SkeletalSegments[i][j][2])] = 1;
}


double Thinner::getSegmentLength(vector<vector<int> > segment, int step)
{
  double length = 0;
  vector<int> prev(3);
  vector<int> crnt(3);
  prev = segment[0];
  /*
  if (segment.size() <= step)
  {
    length = sqrt (eNorm3(prev, segment[segment.size()-1]));
    return length;
  }*/
  for (unsigned i=0; i<segment.size(); i+=step)
  {
    crnt = segment[i];
    length += sqrt( eNorm3(prev, crnt) );
    prev = crnt;
  }
  crnt = *(segment.end()-1);
  length += sqrt( eNorm3(prev, crnt));
  return length;
}


void Thinner::removeShortSegments(unsigned threshold)
{
  queue<vector<int> >            nodesToDel;
  queue<vector<int> >            nodesToDel2;
  vector<vector<vector<int> > >  segmentsToDel;
  vector<vector<vector<int> > >::iterator b_it;
  vector<vector<int> >           segment,fnp;
  vector<int>                    node,neighb;
  vector<vector<int> >::iterator it;
  bool changes = 1;
  int count=0;
  //double radius;
  while (changes)
  {
    ++count;
    segmentsToDel.clear();
    changes = 0;
    findVoxelNodes();
    for (it=VoxelNodes.begin(); it!=VoxelNodes.end(); ++it)
    {
      node = *it;
      if (node[3]!=1 || getIndex(node[0],node[1],node[2]) == leftThinnerOstiaInd 
                     || getIndex(node[0],node[1],node[2]) == rightThinnerOstiaInd)
        continue;
      segment.clear();
      while (1)
      {
        Z[ getIndex(node[0],node[1],node[2])] *= -1;
        fnp.clear();
        for (int i=0; i<26; ++i)
        {
          neighb = node;
          neighb[0] += N26[i][0];
          neighb[1] += N26[i][1];
          neighb[2] += N26[i][2];
          if (Z[ getIndex (neighb[0], neighb[1], neighb[2])] > 0)
            fnp.push_back(neighb);
        }
        if (fnp.size() != 1)
        {
          Z[ getIndex(node[0], node[1], node[2])] *= -1;
          break;
        }
        segment.push_back(node);
        node = fnp[0];
      }
      //if (segment.size() <= 2*max(findRadius(segment[0],0),findRadius(segment[segment.size()-1],0)) )
      if (segment.size() < threshold)
      {
          segmentsToDel.push_back(segment);
          nodesToDel.push(node);
          changes = 1;
      }
      for (unsigned i=0; i<segment.size(); ++i)
      {
        node = segment[i];
        Z[ getIndex(node[0], node[1], node[2])] *= -1;
      }
    }
    // Remove short segments incedent to leaves
    for (b_it=segmentsToDel.begin(); b_it!=segmentsToDel.end(); ++b_it)
    {
      segment = *b_it;
      for (unsigned i=0; i<segment.size(); ++i)
      {
        node = segment[i];
        Z[ getIndex(node[0], node[1], node[2])] = 0;
      }
    }
    // Remove nodes, incedent to deleted segments,
    // and their neighbours, if they are simple
    while (!nodesToDel.empty())
    {
      node = nodesToDel.front();
      nodesToDel.pop();
      if ( isSimple(node) )
      {
        Z[ getIndex(node[0], node[1], node[2])] = 0;
        for (int i=0; i<26; ++i)
        {
          neighb = node;
          neighb[0] += N26[i][0];
          neighb[1] += N26[i][1];
          neighb[2] += N26[i][2];
          if (Z[ getIndex (neighb[0], neighb[1], neighb[2])] > 0)
            nodesToDel2.push(neighb);
        }
      }
    }
    while (!nodesToDel2.empty())
    {
      node = nodesToDel2.front();
      nodesToDel2.pop();
      if ( isSimple(node) && !isEndPoint(node) )
      {
        Z[ getIndex(node[0], node[1], node[2])] = 0;
        for (int i=0; i<26; ++i)
        {
          neighb = node;
          neighb[0] += N26[i][0];
          neighb[1] += N26[i][1];
          neighb[2] += N26[i][2];
          if (Z[ getIndex (neighb[0], neighb[1], neighb[2])] > 0)
            nodesToDel2.push(neighb);
        }
      }
    }
  }
}


void Thinner::printSkeletonOnTxt(char * session)
{
  unsigned x, y, z;
  Foreground.clear();
  vector<int> coord(3,0);

//  Z[ostia_ind]=1;
  
  for (z=0; z<dim[2]; ++z)
    for (y=0; y<dim[1]; ++y)
      for (x=0; x<dim[0]; ++x)
        if (Z[getIndex(x,y,z)] > 0)
        {
          coord[0] = x;
          coord[1] = y;
          coord[2] = z;
          Foreground.push_back(coord);
        }
  for (unsigned i=0; i<SkeletalSegments.size(); ++i)
    for (unsigned j=1; j<SkeletalSegments[i].size()-1; ++j)
      Foreground.push_back(SkeletalSegments[i][j]);

  char path[100]="";
  strcat(path,session);
  strcat(path,"skeleton.txt");

//  ofstream out;
//  out.open (path);
//  out << Foreground.size() << endl;
//  vector<vector<int> >::iterator it;
//  for (it=Foreground.begin(); it!=Foreground.end(); it++)
//    out << (*it)[0] << " " << (*it)[1] << " " << (*it)[2] << " " << endl;
//  out.close();
}


double Thinner::findRadius(vector<int> point, bool vsize_on)
{
  vector<int> p(3);
  vector<int> neighb(3);
  p = point;
  int dist = dmap[ getIndex (p[0], p[1], p[2])];
  int pdist;
  while (dist > 0)
    for (int i=0; i<26; ++i)
    {
      neighb[0] = p[0]+N26[i][0];
      neighb[1] = p[1]+N26[i][1];
      neighb[2] = p[2]+N26[i][2];
      pdist = D(p, neighb);
      if (dmap[ getIndex (neighb[0], neighb[1], neighb[2])] == dist - pdist)
      {
        dist -= pdist;
        p = neighb;
        break;
      }
    }
  if (vsize_on)
    return sqrt((point[0]-p[0])*(point[0]-p[0])*vsize[0]*vsize[0]
              + (point[1]-p[1])*(point[1]-p[1])*vsize[1]*vsize[1]
              + (point[2]-p[2])*(point[2]-p[2])*vsize[2]*vsize[2] );
  else
    return sqrt(double((point[0]-p[0])*(point[0]-p[0])
              + (point[1]-p[1])*(point[1]-p[1])
              + (point[2]-p[2])*(point[2]-p[2]) ) );  
}


double Thinner::eNorm3(vector<int> A, vector<int> B)
{
  return   (A[0] - B[0]) * (A[0] - B[0]) * vsize[0] * vsize[0]
         + (A[1] - B[1]) * (A[1] - B[1]) * vsize[1] * vsize[1]
         + (A[2] - B[2]) * (A[2] - B[2]) * vsize[2] * vsize[2];
}


void Thinner::newBuildTree(unsigned threshold) {
  vector<int> point;
  removeShortSegments (threshold);
  destructToSegments();
}



void Thinner::getFreneFramesAlongTheBranches() {
  // method computes Frene Frames at each point of each branch of graph
  // suppose r(s) is a parametrization of our branch curve
  /*
    assert(Branches.size()>0);
    FreneFrames.clear();
    vector<Utils::FreneFrame> branchFrames;
    
    int branchInd =0;
    for (auto ibranch=Branches.begin(); ibranch!=Branches.end(); ibranch++, branchInd++){
        branchFrames.clear();

        unsigned const branchSize = ibranch->size();
        vector<vector<double> > dr;
        vector<vector<double> > ddr;

        auto ibranchBegin = ibranch->begin();
        auto ibranchEnd = ibranch->end()-1;

        //compute first derivatives dr at each ibranch point
        unsigned pointInd=0;
        for (auto ipoint=ibranch->begin(); ipoint!=ibranch->end(); ++ipoint, pointInd++) {
            double dr_point[3];
            if (ipoint == ibranch->begin()) {
                // first branch point
                auto nextPoint = *(ipoint+1);
                for (int i=0;i <3; ++i)
                    dr_point[i] = (*ipoint)[i] - nextPoint[i];
            } else if (ipoint == ibranch->end()-1) {
                // last branch point
                auto prevPoint = *(ipoint-1);
                for (int i=0;i <3; ++i)
                    dr_point[i] = prevPoint[i] - (*ipoint)[i];
            } else {
                // middle branch point
                auto nextPoint = *(ipoint+1);
                auto prevPoint = *(ipoint-1);
                for (int i=0; i<3; ++i)
                    dr_point[i] = (prevPoint[i] - nextPoint[i])/2;
            }
            //TODO нужно ли нормализовывать r(s)? у нас не натуральный параметр
            Utils::normalize(dr_point);

            vector<double> dr_vec(3);
            for (int i=0; i<3; i++)
                dr_vec[i]=dr_point[i];
            dr.push_back(dr_vec);
        }

        //compute second derivatives ddr at each ibranch point using ddr
        pointInd=0;
        for (auto ipoint=ibranch->begin(); ipoint!=ibranch->end(); ++ipoint, pointInd++) {
            double ddr_point[3];
            if (ibranchBegin == ipoint) {
                // first branch point
                auto nextPoint = *(ipoint+1);
                for (int i=0;i <3; ++i)
                    ddr_point[i] = dr[pointInd][i] - dr[pointInd+1][i];
            } else if (ibranchEnd == ipoint) {
                // last branch point
                auto prevPoint = *(ipoint-1);
                for (int i=0;i <3; ++i)
                    ddr_point[i] = dr[pointInd-1][i] - dr[pointInd][i];
            } else {
                // middle branch point
                auto nextPoint = *(ipoint+1);
                auto prevPoint = *(ipoint-1);
                for (int i=0;i <3; ++i)
                    ddr_point[i] = (dr[pointInd-1][i] - dr[pointInd+1][i]) / 2;
            }
            // normalize ddr
            Utils::normalize(ddr_point);

            vector<double> ddr_vec(3);
            for (int i=0; i<3; i++)
                ddr_vec[i]=ddr_point[i];
            ddr.push_back(ddr_vec);
            //assert(fabs(ddr[pointInd][0]*dr[pointInd][0] + ddr[pointInd][1]*dr[pointInd][1] + ddr[pointInd][2]*dr[pointInd][2]) < 1e-9);
        }

        // compute Frene Frames
        branchFrames.clear();
        //vector<vector<double> > newBranchFrames;

        for (unsigned i=0; i<branchSize; i++) {
            //cout << "\nbranch "<<branchInd << ", point = " << i<<endl;
            //cout << "dr[" << i<<"] = "<< dr[i][0]<<" "<< dr[i][0]<<" "<< dr[i][0]<<"\n";
            //cout << "ddr[" << i<<"] = "<< ddr[i][0]<<" "<< ddr[i][0]<<" "<< ddr[i][0]<<"\n";
            Utils::FreneFrame frame;
            for (int j=0; j<3; j++){
                frame.t[j] = dr[i][j];
                frame.n[j] = ddr[i][j];
            }
            // fix normal direction for straight segments
            // TODO может лучше сделать непрерывное преобразование из начальногоо ненулевого положения в конечное?
            if (fabs(Utils::length(frame.n)) < 1e-10 ) {
                if (i==0){
                    //cout << "CHOOSE DIRECTION" <<endl;
                    // choose any direction perpendicular t[j]
                    if (fabs(frame.t[0]) > 1e-10) {
                        frame.n[0]=0;
                        if ( fabs(frame.t[1])> 1e-10) {
                            frame.n[2] = 1.0;
                            frame.n[1] = frame.n[2] * frame.t[2] / frame.t[1];
                        } else if (fabs(frame.t[2])> 1e-10) {
                            frame.n[1] = 1.0;
                            frame.n[2] = frame.n[1] * frame.t[1] / frame.t[2];
                        } else
                            frame.n[1] = frame.n[2] = 0.5;
                    } else if (fabs(frame.t[1]) > 1e-10) {
                        frame.n[1]=0;
                        if ( fabs(frame.t[0])> 1e-10) {
                            frame.n[2] = 1.0;
                            frame.n[0] = frame.n[2] * frame.t[2] / frame.t[0];
                        } else if (fabs(frame.t[2])> 1e-10) {
                            frame.n[0] = 1.0;
                            frame.n[2] = frame.n[0] * frame.t[0] / frame.t[2];
                        } else
                            frame.n[0] = frame.n[2] = 0.5;
                    } else {
                        frame.n[2]=0;
                        if ( fabs(frame.t[1])> 1e-10) {
                            frame.n[0] = 1.0;
                            frame.n[1] = frame.n[0] * frame.t[0] / frame.t[1];
                        } else if (fabs(frame.t[0])> 1e-10) {
                            frame.n[1] = 1.0;
                            frame.n[0] = frame.n[1] * frame.t[1] / frame.t[0];
                        } else
                            frame.n[1] = frame.n[0] = 0.5;
                    }

                } else {
                    //cout << "COPY N!\n";
                    for (int j = 0; j < 3; j++)
                        frame.n[j] = (*(branchFrames.end() - 1)).n[j];
                }
            }
            Utils::normalize(frame.n);

            vector<double> tmp(3);
            for(int j=0; j<3; j++)
                tmp[j] = frame.n[j];
            Utils::crossProdV(dr[i], tmp, frame.b);

            branchFrames.push_back(frame);
            
            //vector<double> newFrame(9);
            //for (int ii=0; ii<3; ii++) {
            //  newFrame[ii]   = frame.t[ii];
            //  newFrame[3+ii] = frame.n[ii];
            //  newFrame[6+ii] = frame.b[ii];
            //}
            //newBranchFrames.push_back(newFrame);
            
        }
        assert(branchFrames.size() == ibranch->size());
        FreneFrames.push_back(branchFrames);
    }

    assert(Branches.size() == FreneFrames.size());
    
    // PRINT FRAMES DEBUG
    ofstream ofs;
    ofs.open("frames.txt");
    ofs << FreneFrames.size()<<endl;
    int branchNo=0;
    for (auto frames = FreneFrames.begin(); frames!=FreneFrames.end(); ++frames,branchNo++) {
        int pointNo=0;
        for (auto iframe=frames->begin(); iframe!=frames->end(); iframe++, pointNo++) {
            ofs << "branch "<<branchNo << ", point "<<pointNo << "\n";
            ofs << "t: " << iframe->t[0] << " "<< iframe->t[1] << " "<< iframe->t[2] << "\n" ;
            ofs << "n: " << iframe->n[0] << " "<< iframe->n[1] << " "<< iframe->n[2] << "\n" ;
            ofs << "b: " << iframe->b[0] << " "<< iframe->b[1] << " "<< iframe->b[2] << "\n\n" ;
        }
    }
    ofs.close();
    */
}

void Thinner::outputFreneFrames(vector<vector<vector <double > > > result){
  /*
  ofstream o;
  o.open("log_outFrame.txt");

  o << "FreneFrames.size() = " << FreneFrames.size() << ", Branches.size() = " << Branches.size()<<endl;
  o<< "begin\n";

  assert(FreneFrames.size() == Branches.size());
  result.clear();
  for (vector<vector<Utils::FreneFrame> >::iterator branchFrames = FreneFrames.begin(); branchFrames!=FreneFrames.end(); branchFrames++) {
    o << "branch ";
    vector<vector<double> > branch;
    for (vector<Utils::FreneFrame>::iterator iFrame=branchFrames->begin(); iFrame!=branchFrames->end(); ++iFrame) {
      vector<double> frame(9);
      for (int i=0; i<3; i++) {
        frame[i]= iFrame->t[i];
        frame[3+i] = iFrame->n[i];
        frame[6+i] = iFrame->b[i];
      }
      branch.push_back(frame);
    } 
    o << branch.size() << endl;
    result.push_back(branch);
  }
  o.close();
  return;
  */
}
