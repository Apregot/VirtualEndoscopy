#include "stdafx.h"
#include "Headers/idt.hpp"

void FFRService_update_progres(float relativeProgress, const wchar_t* status);  // forward declaration

//using namespace std;

IDT::IDT (const char *_dir_name,
          const double _thold,
          const double _ratio_thold,
          const int ground,
          const int background,
          const int seed)
{
  thold = _thold;
  ratio_thold = _ratio_thold;
  dir_name = _dir_name;
  Image = 0;
  mask = 0;
  distanceMap = 0;
  Nodes = 0;
  Weights = 0;
  Diagonal = 0;
  Edges = 0;
  tree = 0;
  degree = 0;
  ordering = 0;
  solution = 0;
  partition = 0;
  resulting_mask = 0;
  //ParseDicomImage();

  if (Image[seed] <= thold)
  {
    //cout<<"IDT: wrong seed (seed intensity is lower than threshold)"<< endl;
    exit(0);
  }
  getMask(seed);
  double ratio = mainAlgorithm(ground, background);
//  cout<< ratio<<endl;
}

IDT::IDT (short * CubeData,
		 const double _thold,
         const double _ratio_thold,
         const int ground,
		 unsigned long long * dim,
		 double * _vsize,
         const int seed)
{
  thold = _thold;
  ratio_thold = _ratio_thold;
  Image = nullptr;
  mask = nullptr;
  distanceMap = nullptr;
  Nodes = nullptr;
  Weights = nullptr;
  Diagonal = nullptr;
  Edges = nullptr;
  tree = nullptr;
  degree = nullptr;
  ordering = nullptr;
  solution = nullptr;
  partition = nullptr;
  resulting_mask = nullptr;
  solutionOrder = nullptr;

  vsize[0]=_vsize[0]; vsize[1]=_vsize[1]; vsize[2]=_vsize[2];
  k=dim[0]; l=dim[1]; m=dim[2];
  n = k*l*m;
  Image = CubeData;
  
  if (Image[seed] <= thold)
  {
      throw std::runtime_error("IDT: wrong seed!");
  }
  FFRService_update_progres(0.15f, L"Aorta segmentation");
  getMask(seed);
  FFRService_update_progres(0.20f, L"Aorta segmentation");
  double ratio = mainAlgorithm(ground, -1);
}


IDT::~IDT()
{
	//Image = 0;
	if (mask != nullptr) { delete[] mask; mask = nullptr; }
	if (distanceMap != nullptr) { delete[] distanceMap; distanceMap = nullptr; }
	if (Nodes != nullptr) { delete[] Nodes; Nodes = nullptr;}
	if (Weights != nullptr) { delete[] Weights; Weights = nullptr; }
	if (tree != nullptr) { delete[] tree; tree = nullptr; }
	if (degree != nullptr) { delete[] degree; degree = nullptr; }
	if (ordering != nullptr) { delete[] ordering; ordering = nullptr; }
	if (solution != nullptr) { delete[] solution; solution = nullptr;}
	if (partition != nullptr) { delete[] partition; partition = nullptr; }
	if (Diagonal != nullptr) { delete[] Diagonal; Diagonal = nullptr; }
	if (Edges != nullptr) { delete[] Edges; Edges = nullptr; }
	if (resulting_mask != nullptr) { delete[] resulting_mask; resulting_mask = nullptr;}
	if (solutionOrder != nullptr) { delete[] solutionOrder; solutionOrder= nullptr; }
}

double IDT::mainAlgorithm(const int ground, const int background)
{
  //cout <<num_of_nodes<<" nodes\n";
  //cout << "aorta segmentation \n";
  if (resulting_mask != nullptr) {delete [] resulting_mask; resulting_mask= nullptr;}
  try {
	  resulting_mask = new bool[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.resulting_mask");
  }
  
  if (distanceMap != nullptr) {delete [] distanceMap; distanceMap=nullptr;}
  try {
	  distanceMap = new unsigned[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.resulting_mask");
  }

  ofstream o("log_idt.txt");
  o << "getNodes" << endl;
  getNodes (ground, background);
  FFRService_update_progres(0.22f, L"Aorta segmentation");
  o << "getDmap" << endl;
  getDistanceMap(mask, 0);
  FFRService_update_progres(0.25f, L"Aorta segmentation");
  o << "getWeights" << endl;
  getWeights();
  FFRService_update_progres(0.28f, L"Aorta segmentation");
  o << "getEdges" << endl;
  getEdges();
  FFRService_update_progres(0.30f, L"Aorta segmentation");
  o << "PrimMethod" << endl;
  PrimMethod();
  FFRService_update_progres(0.65f, L"Aorta segmentation");
  o << "getOrdering"<< endl;
  getOrdering();
  FFRService_update_progres(0.66f, L"Aorta segmentation");
  o << "solveSystem" << endl;
  solveSystem();
  FFRService_update_progres(0.70f, L"Aorta segmentation");
  o << "removeVessels" << endl;
  double ratio = getRatioCut();
  FFRService_update_progres(0.90f, L"Aorta segmentation");
  removeVessels(unsigned(floor(0.5+5./vsize[0])));
  FFRService_update_progres(0.99f, L"Aorta segmentation");
  o << "done" << endl;
  o.close();
  //for (int i=0; i<n; ++i ) 
  //  resulting_mask[i] = mask[i];
  return ratio;
}

/*
void IDT::ParseDicomImage()
{
  if (Image) { delete[] Image; Image = nullptr; }
  vtkSmartPointer<vtkDICOMImageReader> reader = vtkSmartPointer<vtkDICOMImageReader>::New();
  reader->SetDirectoryName(dir_name);
  reader->Update();

  vtkImageData *f = reader->GetOutput();

  f->GetSpacing(vsize);
  int dim[3];
  f->GetDimensions(dim);
  k = dim[0];
  l = dim[1];
  m = dim[2];
  n = f->GetNumberOfPoints();
  Image = new int [n];

  vtkShortArray* array = vtkShortArray::SafeDownCast ( f->GetPointData()->GetScalars() );
  for (int z=0; z<dim[2]; ++z)
    for (int y=0; y<dim[1]; ++y)
      for (int x=0; x<dim[0]; ++x)
        Image[(z*dim[1] + y)*dim[0] + x] = array->GetValue((z*dim[1] + y)*dim[0] + x);
}
*/
void IDT::getMask(const int seed)
{
  int nbr;
  num_of_nodes = 0;
  if(mask != nullptr) { delete[] mask; mask = nullptr; }
  try {
	  mask = new bool[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.mask");
  }
  // std::queue is faster than std::set in this case
  std::queue<int> front;

  std::fill(mask, mask+n, 0);

  front.push(seed);
  mask[seed] = 1;
  ++num_of_nodes;

  while (!front.empty())
  {
    int coord = front.front();
    front.pop();

    if (!atFace0(coord))
    {
      nbr = coord-k*l;
      if (thold <= Image[nbr] && mask[nbr] == 0 )
      {
        mask[nbr] = 1;
        front.push(nbr);
        ++num_of_nodes;
      }
    }
    if (!atFace1(coord))
    {
      nbr = coord-k;
      if (thold <= Image[nbr] && mask[nbr] == 0 )
      {
        mask[nbr] = 1;
        front.push(nbr);
        ++num_of_nodes;
      }
    }
    if (!atFace2(coord))
    {
      nbr = coord-1;
      if (thold <= Image[nbr] && mask[nbr] == 0 )
      {
        mask[nbr] = 1;
        front.push(nbr);
        ++num_of_nodes;
      }
    }
    if (!atFace3(coord))
    {
      nbr = coord+1;
      if (thold <= Image[nbr] && mask[nbr] == 0 )
      {
        mask[nbr] = 1;
        front.push(nbr);
        ++num_of_nodes;
      }
    }
    if (!atFace4(coord))
    {
      nbr = coord+k;
      if (thold <= Image[nbr] && mask[nbr] == 0 )
      {
        mask[nbr] = 1;
        front.push(nbr);
        ++num_of_nodes;
      }
    }
    if (!atFace5(coord))
    {
      nbr = coord+k*l;
      if (thold <= Image[nbr] && mask[nbr] == 0 )
      {
        mask[nbr] = 1;
        front.push(nbr);
        ++num_of_nodes;
      }
    }
  }
}

int IDT::atFace0(const int i)
{
  if (i < k*l)
    return 1;
  return 0;
}
int IDT::atFace1(const int i)
{
  if ( (i/k)%l == 0)
    return 1;
  return 0;
}
int IDT::atFace2(const int i)
{
  if ( i%k == 0)
    return 1;
  return 0;
}
int IDT::atFace3(const int i)
{
  if ( i%k == k-1)
    return 1;
  return 0;
}
int IDT::atFace4(const int i)
{
  if ( (i/k)%l == l-1)
    return 1;
  return 0;
}
int IDT::atFace5(const int i)
{
  if (i >= k*l*(m-1))
    return 1;
  return 0;
}

void IDT::getNodes (const int ground, const int background)
{
  int count = 0;
  if (Nodes != nullptr) { delete[] Nodes; Nodes = nullptr;}
  try {
	  Nodes = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.Nodes");
  }

  background_node = -1;
  for (int i=0; i<n; ++i)
    if (mask[i])
    {
      Nodes[count] = i;
      if (ground == i)
        ground_node = count;
      if (background == i)
        background_node = count;
      ++count;
    }
}

void IDT::getDistanceMap(bool * _mask, bool rule)
{
  unsigned temp;
  //if(distanceMap) { delete[] distanceMap; distanceMap = nullptr;}
  if (distanceMap == nullptr) {
	  try {
		  distanceMap = new unsigned[n];
	  } catch (std::bad_alloc) {
          throw std::runtime_error("Bad Alloc IDT.distanceMap");
	  }
  }
  for (int i=0; i<n; ++i)
    distanceMap[i] = 0;

  for (int i=0; i<n; ++i)
  {
    if ( ( (!rule) ? _mask[i] : !(_mask[i]) ) )
    {
      temp = k+l+m;
      if (!atFace2(i))
        if (temp > 1+distanceMap[i-1])
          temp = 1+distanceMap[i-1];
      if (!atFace1(i))
        if (temp > 1+distanceMap[i-k])
          temp = 1+distanceMap[i-k];
      if (!atFace0(i))
        if (temp > 1+distanceMap[i-k*l])
          temp = 1+distanceMap[i-k*l];
      distanceMap[i] = temp;
    }
    else
    {
      distanceMap[i] = 0;
    }
  }

  for (int i=n-1; i>-1; --i)
  {
    temp = distanceMap[i];
    if (!temp)
      continue;
    if (!atFace3(i))
    {
      if (temp > 1+distanceMap[i+1])
      temp = 1+distanceMap[i+1];
    }
    if (!atFace4(i))
    {
      if (temp > 1+distanceMap[i+k])
        temp = 1+distanceMap[i+k];
    }
    if (!atFace5(i))
    {
      if (temp > 1+distanceMap[i+k*l])
        temp = 1+distanceMap[i+k*l];
    }
    distanceMap[i] = temp;
  }
}

void IDT::getWeights()
{
  int ind;
  int temp = -1;
  if (Weights != nullptr) { delete[] Weights; Weights = nullptr;}
  try {
	  Weights = new int[6 * num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.Weights");
  }
  for (int i = 0; i<6*num_of_nodes; ++i)
    Weights[i] = 0;

  for (int i = 0; i<num_of_nodes; ++i)
  {
    ind = Nodes[i];
    if (!atFace0(ind))
    {
      temp = distanceMap[ind - k*l];
      if (temp > 0)
        Weights[6*i] = temp + distanceMap[ind];
    }
    if (!atFace1(ind))
    {
      temp = distanceMap[ind - k];
      if (temp > 0)
      Weights[6*i+1] = temp + distanceMap[ind];
    }
    if (!atFace2(ind))
    {
      temp = distanceMap[ind - 1];
      if (temp > 0)
        Weights[6*i+2] = temp + distanceMap[ind];
    }
    if (!atFace3(ind))
    {
      temp = distanceMap[ind + 1];
      if (temp > 0)
      Weights[6*i+3] = temp + distanceMap[ind];
    }
    if (!atFace4(ind))
    {
      temp = distanceMap[ind + k];
      if (temp > 0)
        Weights[6*i+4] = temp + distanceMap[ind];
    }
    if (!atFace5(ind))
    {
      temp = distanceMap[ind + k*l];
      if (temp > 0)
        Weights[6*i+5] = temp + distanceMap[ind];
    }
  }
}

void IDT::getEdges()
{
  int* flags;  //to find Node number by its coordinate
  int ind;

  try {
	  flags = new int[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.flags");
  }
  if (Edges != nullptr) { delete[] Edges; Edges = nullptr;}
  try {
    Edges = new int[6 * num_of_nodes];
  } catch (std::bad_alloc) {
    throw std::runtime_error("Bad Alloc IDT.Edges");
  }
  std::fill(flags, flags+n, -1);
  for (int i = 0; i<num_of_nodes; ++i)
    flags[Nodes[i]] = i;

  unsigned long long count=0;
  int kl=k*l;
  for (int i = 0; i<num_of_nodes; ++i)
  {
    ind = Nodes[i];
    // Only save endpoins of edges in a flat array
    // Flat array should be much faster than vector<vector<pair<int,int>>>
    // Memory footprint is also reduced
    //count = 6*i
    Edges[count] = ind-kl >= 0 ? flags[ind-kl] : -1;
    ++count; // count = 6*i+1
    Edges[count] = ind-k >= 0 ? flags[ind-k] : -1;
    ++count; // count = 6*i+2
    Edges[count] = ind-1 >= 0 ? flags[ind-1] : -1;
    ++count; // count = 6*i+3
    Edges[count] = ind+1 < n ? flags[ind+1] : -1;
    ++count; // count = 6*i+4
    Edges[count] = ind+k < n ? flags[ind+k] : -1;
    ++count; // count = 6*i+5
    Edges[count] = ind+kl < n ? flags[ind+kl] : -1;
    ++count;
  }
  delete[] flags;
}

void IDT::IndependantPrimMethod()
{
  int inf = 2*(k+m+l);
  int max_label_node;

  if (tree != nullptr) { delete[] tree; tree = nullptr;}
  try {
	  tree = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.tree");
  }

  if (degree != nullptr) { delete[] degree; degree = nullptr;}
  try {
	  degree = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.degree");
  }

  for (int i=0; i<num_of_nodes; ++i )
    degree[i] = 0;

  vector< set<pair<int,int> > > tempEdges(num_of_nodes);
  vector<int> max_e(num_of_nodes,inf);
  vector <bool> used(num_of_nodes, 0);
  set<pair<int,int> > label;
  set<pair<int,int> >::iterator it;

  int max_ind = 0;
  int max_weight=0;
  for (int i=0; i<num_of_nodes;++i)
  {
    int weight = 0;
    for (int j=6*i; j<6*(i+1); ++j)
      weight += Weights[j];
    //weight = (*--Edges[i].end()).first;
    if (weight > max_weight)
    {
      max_weight = weight;
      max_ind = i;
    }
  }

  used[max_ind] = 1;

  for (int i=6*max_ind; i<6*(max_ind+1); ++i)
  {
    if (Weights[i]) {
      label.insert({Weights[i], Edges[i]});
      max_e[Edges[i]] = Weights[i];
    }
  }

  for(int size = 1; size < num_of_nodes+1;++size)
  {
    if(label.empty())
    {
//      cout << "Tree contains "<< size <<" nodes" << endl;
      break;
    }
    max_label_node = (*--label.end()).second;

    it = label.end();
    --it;
    label.erase (it);

    int temp_node = 0;
    int temp_weight = 0;

    for (int i=6*max_label_node; i<6*(max_label_node+1); ++i)
    {
      if (Weights[i] > temp_weight && used[Edges[i]])
      {
        temp_node = Edges[i];
        temp_weight = Weights[i];
      }
    }
    pair<int,int> edge = make_pair(max_label_node,temp_node);
    TreeEdges.push_back(edge);

    set<pair<int,int> > incedentSet = tempEdges[max_label_node];
    incedentSet.insert(edge);
    tempEdges[max_label_node] = incedentSet;
    incedentSet = tempEdges[temp_node];
    incedentSet.insert(make_pair( temp_node, max_label_node));
    tempEdges[temp_node] = incedentSet;

    //tree[max_label_node] = temp_node;
    ++degree[max_label_node];
    ++degree[temp_node];
    used[max_label_node] = 1;

    for (int i=6*max_label_node; i<6*(max_label_node+1); ++i)
    {
      temp_node = Edges[i];
      temp_weight = Weights[i];
      if (!used[temp_node])
      {
        if (max_e[temp_node] < temp_weight || max_e[temp_node]==inf)
        {
          label.erase (make_pair (max_e[temp_node],temp_node));
          max_e[temp_node] = temp_weight;
          label.insert (make_pair (max_e[temp_node],temp_node));
        }
      }
    }
  }
  tree_root = ground_node;
  tree[tree_root] = 0;
  /*==================================*/
  /*          get tree with           */
  /*          ground root             */
  /*==================================*/
  int *deg;
  try {
	  deg = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.deg");
  }

  for (int i = 0; i< num_of_nodes; ++i)
    deg[i] = degree[i];
    deg[ground_node] = 0;

  for (int i = 0; i< num_of_nodes; ++i)
  {
    int current = i;
    while (deg[current]==1)
    {
      int next = (*tempEdges[current].begin()).second;
      tempEdges[current].erase(make_pair(current,next));
      tempEdges[next].erase(make_pair(next,current));
      --deg[current];
      --deg[next];
      tree[current] = next;
      //cout<< tree[current]<<endl;
      current = next;
    }
  }

  delete[] deg;
}

void IDT::PrimMethod()
{
  int inf = 2*(k+m+l);
  int max_label_node;

  if (tree != nullptr) { delete[] tree; tree = nullptr;}
  try{
  tree = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.tree");
  }
  
  if (degree != nullptr) { delete[] degree; degree = nullptr;}
  try {
	  degree = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.degree");
  }
  for (int i=0; i<num_of_nodes; ++i )
	  degree[i] = 0;

  vector<int> max_e(num_of_nodes,inf);
  vector <bool> used(num_of_nodes, 0);
  // Replace set<pair<int,int>> with two priority_queues
  std::priority_queue<std::pair<int,int> > label;
  // skiplabel queue is used to skip elements in label queue, since we can not erase from label
  std::priority_queue<std::pair<int,int> > skiplabel;

  tree_root = ground_node;
  used[tree_root] = 1;

  for (int i=6*tree_root; i<6*(tree_root+1); ++i)
  {
    if (Weights[i]) {
      label.emplace(Weights[i], Edges[i]);
      max_e[Edges[i]] = Weights[i];
    }
  }
  for(int size = 1; size < num_of_nodes+1;++size)
  {
  //cout <<size<< endl;
    // Skip elements from skiplabel queue
    while (!skiplabel.empty() && !label.empty() && skiplabel.top() >= label.top()) {
      if (skiplabel.top() == label.top())  label.pop();
      skiplabel.pop();
    }
    if(label.empty())
    {
      //cout << "Tree contains "<< size <<" nodes" << endl;
      break;
    }
    max_label_node = label.top().second;

    label.pop();

    int temp_node = 0;
    int temp_weight = 0;

    for (int i=6*max_label_node; i<6*(max_label_node+1); ++i)
    {
      if (Weights[i] > temp_weight && used[Edges[i]])
      {
        temp_node = Edges[i];
        temp_weight = Weights[i];
      }
    }

    //TreeEdges.push_back(make_pair(max_label_node,temp_node));
    tree[max_label_node] = temp_node;
    ++degree[max_label_node];
    ++degree[temp_node];
    used[max_label_node] = 1;

    for (int i=6*max_label_node; i<6*(max_label_node+1); ++i)
    {
      temp_node = Edges[i];
      temp_weight = Weights[i];
      if (temp_node >=0 && !used[temp_node])
      {
        if (max_e[temp_node] < temp_weight || max_e[temp_node]==inf)
        {
          // Add old pair to skiplabel queue
          skiplabel.emplace(max_e[temp_node],temp_node);
          max_e[temp_node] = temp_weight;
          // Add new pair to label queue
          label.emplace(max_e[temp_node],temp_node);
        }
      }
    }
  }
  max_e.clear();
  used.clear();
//degree[tree_root] = 0;
}

void IDT::getOrdering()
{
  int* deg;
  try {
	  deg = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.deg");
  }
  for (int i=0; i<num_of_nodes; ++i)
    deg[i] = degree[i];

  if (ordering != nullptr) { delete[] ordering; ordering = nullptr;}
  try {
	  ordering = new int[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.ordering");
  }

  int next_node,current_node;
  int kk=0;

  tree[tree_root] = 0;
  deg[tree_root] = 0;
  ordering[num_of_nodes-1] = ground_node;

  for (int i=0; i<num_of_nodes; ++i)
  {
    current_node = i;
    while( deg[current_node]==1 )
    {
      ordering[kk] = current_node;
      deg[current_node]--;
      next_node = tree[current_node];
      deg[next_node]--;
      current_node = next_node;
      ++kk;
    }
  }
  delete[] deg;
}

void IDT::solveSystem()
{
  double *rhs;
  double *diagonal;
  try {
	  rhs = new double[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.rhs");
  }
  
  try {
	  diagonal = new double[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.diagonal");
  }
  for (int i = 0; i<num_of_nodes; ++i)
  {
    rhs[i] = 1;//degree[i];
    diagonal[i] = degree[i];
  }
  rhs[ordering[num_of_nodes-1]]=0;

  if (solution == nullptr) {
	  try {
		  solution = new long double[num_of_nodes];
	  } catch (std::bad_alloc) {
          throw std::runtime_error("Bad Alloc IDT.solution");
	  }
  }
  for (int i=0; i< num_of_nodes; ++i)
    solution[i] = 0;

  /*==========================*/
  /*        Forward pass      */
  /*==========================*/
  for (int i=0; i<num_of_nodes-1; ++i)
  {
    rhs[tree[ordering[i]]] += rhs[ordering[i]]/diagonal[ordering[i]];
    diagonal[tree[ordering[i]]] -= 1./diagonal[ordering[i]];

  }

  solution[ordering[num_of_nodes-1]] = 0;
  //rhs[ordering[num_of_nodes-1]]/diagonal[ordering[num_of_nodes-1]];
  /*==========================*/
  /*       Backward pass      */
  /*==========================*/

  for (int i = num_of_nodes-2; i>=0; --i)
  {
    solution[ordering[i]] = solution[tree[ordering[i]]]
                          + rhs[ordering[i]]/diagonal[ordering[i]];
    if (solution[ordering[i]]<0)
    {
      //cout << solution[tree[ordering[i]]] << ' ' <<rhs[ordering[i]]/diagonal[ordering[i]]<<endl;
      exit(1);
    }
  }
  delete[] rhs;
  delete[] diagonal;
}


void IDT::sortNodesBySolution()
{
  if (solutionOrder == nullptr) {
	  try {
		  solutionOrder = new int[num_of_nodes];
	  } catch (std::bad_alloc) {
          throw std::runtime_error("Bad Alloc IDT.solutionOrder");
	  }
  }

  // Create permutation index
  std::iota(solutionOrder, solutionOrder+num_of_nodes, 0);
  // Sort permutation index
  std::stable_sort(solutionOrder, solutionOrder+num_of_nodes,
       [&](int a, int b) {return solution[a] < solution[b];});
  return;
}

void IDT::getPartitionByPercent(double percent)
{
	if (!partition || !solutionOrder) return;
	int thrhld = percent * (num_of_nodes);
	if (thrhld  > num_of_nodes)
		thrhld = num_of_nodes;
	for (int i=0; i<thrhld; ++i)
	  partition[solutionOrder[i]]=1;
	for (int i=thrhld; i<num_of_nodes; ++i)
	  partition[solutionOrder[i]]=0;
	//if (resulting_mask) { delete[] resulting_mask; resulting_mask = nullptr;}
  if (resulting_mask == nullptr) {
	  try {
		  resulting_mask = new bool[n];
	  } catch (std::bad_alloc) {
          throw std::runtime_error("Bad alloc IDT.resulting_mask");
	  }
  }
  memset(resulting_mask,0,n);
  for (int i=0; i<num_of_nodes; ++i)
    if (partition[i])
      resulting_mask[Nodes[i]] = 1;
	return;
}

double IDT::getRatioCut()
{
  int * flags;
  try {
	  flags = new int[n];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad Alloc IDT.flag");
  }
  
  for (int i=0; i<n; ++i)
    flags[i] = -1;
  for (int i=0; i<num_of_nodes; ++i)
    flags[Nodes[i]] = i;

  int area = 0;

  signed char *Lapl_vect;			// temporary vector for L*partition
  try {
	  Lapl_vect = new signed char[num_of_nodes];
  } catch (std::bad_alloc) {
      throw std::runtime_error("Bad throw IDT.Lapl_vect");
  }
  //set<pair<long double,int> > sorter;
  //vector<int> index;
  
  if (partition == nullptr) {
	  try {
		  partition = new bool[num_of_nodes];
	  } catch (std::bad_alloc) {
          throw std::runtime_error ("Bad alloc IDT.partition");
	  }
  }
  if (Diagonal == nullptr) {
	  try {
		  Diagonal = new char[num_of_nodes];
	  } catch (std::bad_alloc) {
          throw std::runtime_error ("Bad Alloc IDT.Diagonal");
      }
  }
  for (int i=0; i<num_of_nodes; ++i)
  {
    Lapl_vect[i] = 0;
    partition[i] = 0;
    Diagonal[i] = 0;
    for (int j=0; j<6; ++j)
      if (Weights[6*i+j]>0)
        ++Diagonal[i];
  }

  sortNodesBySolution();

  // Helper struct to lazily find extrema points on a curve
  struct ExtremaDetector : std::deque<std::pair<int, int>> {
    std::pair<int, int> prev;            // Previous extrema for min/max filter
    int dir = 0;                         // Current direction for min/max filters
    void put(const std::pair<int, int>& value) {
      if (dir == 0) { // First value: store it and initialize dir
        prev = value;
        dir = -1; // Mark previous direction descending, so the first value will be marked as extremum if the second value is bigger
      } else if (value.second != prev.second) { // New value differs from previous
        if ((value.second - prev.second)*dir < 0) { // Monotonicity direction changed
          push_back(prev); // Push previous extremum to deque
          dir *= -1; // Invert current direction
        }
        prev = value;
      }
    }
    void finish() {
      if (dir!=0)  push_back(prev); // Push the last value
    }
    // Aliases
    inline void put(int i, int v) {put(std::make_pair(i, v));}
  };
  // Helper struct to lazily analyze curve: computes min/max with sliding window and finds extrema points
  struct CurveAnalyzer : ExtremaDetector {
    const int minmax = 0;                     // -1 for min, +1 for max
    const int window_size = 0;                // Size of the sliding window
    std::deque<std::pair<int, int>> window;   // Deque for sliding min/max filter

    CurveAnalyzer(int minmax, int window_size) :
      minmax(minmax),
      window_size(window_size) {};
    // Main logic: min/max filter + unique + local extrema + save to buf
    void put(int i, int v) {
      // Min/max sliding windows filter
      // Remove old entries
      while (!window.empty() && window.front().first <= i-window_size)  window.pop_front();
      // Remove useless entries
      while (!window.empty() && (v - window.back().second)*minmax >= 0)  window.pop_back();
      // Add current value
      window.emplace_back(i, v);
      // Pass the value to ExtremaDetector
      ExtremaDetector::put(i, window.front().second);
    }
  };
  // Helper struct to search for best interval
  struct BestIntervalLocator {
    const int window_size;                // Sliding window size, e.g. equivalent of 1 ml
    CurveAnalyzer vmin, vmax;             // Min/max filtered extrema
    ExtremaDetector coarse_curve;                  // Extrema for medial curve
    bool minShifted = false;
    BestIntervalLocator(int window_size) :
      window_size(window_size),
      vmin(-1, window_size),
      vmax(1, window_size) {
    }
    void put(int i, int v) {
      vmin.put(i, v);
      vmax.put(i, v);
      minShift();
      if (vmin.size() > 1 && vmax.size() > 1)  merge();
    }
    void finish() {
      vmin.finish();
      vmax.finish();
      minShift();
      while (!vmin.empty() || !vmax.empty())  merge();
      coarse_curve.finish();
    }
    std::pair<int, int> bestInterval(int lower, int upper, int minLength, double minRelativeLength = 1.2) const {
      double bestRatio = -1.0;
      std::pair<int, int> best;
      for (int i=0; i<coarse_curve.size()-1; i++) {
        if (coarse_curve[i].first < lower/2)  continue;
        if (coarse_curve[i].first > upper)  break;
        for (int j=i+1; j<coarse_curve.size(); j++) {
          if (coarse_curve[j].first < lower)  continue;
          if (coarse_curve[j].second <= coarse_curve[i].second)  continue;
          if (coarse_curve[j].first - coarse_curve[i].first < minLength)  continue;
          if (double(coarse_curve[j].first)/coarse_curve[i].first < minRelativeLength)  continue;
          double ratio = double(coarse_curve[j].second - coarse_curve[i].second)/(coarse_curve[j].first - coarse_curve[i].first);
          if (ratio > bestRatio) {
            best.first = coarse_curve[i].first;
            best.second = coarse_curve[j].first;
            bestRatio = ratio;
          }
        }
      }
      return best;
    }
    inline void minShift() {
      if (minShifted)  return;
      if (vmin.empty())  return;
      vmin.pop_front();
      minShifted = true;
    }
    inline void merge() {
      int next_i = -2;
      int min_i = vmin.empty() ? -1 : vmin.front().first;
      int max_i = vmax.empty() ? -1 : vmax.front().first;
      if (min_i >= 0 && (next_i < 0 || min_i < next_i))  next_i = min_i;
      if (max_i >= 0 && (next_i < 0 || max_i < next_i))  next_i = max_i;
      if (next_i < 0)  return; // Nothing to do
      int value = 0;
      int count = 0;
      if (min_i == next_i) {
        value += vmin.front().second;
        ++count;
        vmin.pop_front();
        if (!vmin.empty())  vmin.pop_front();
      }
      if (max_i == next_i) {
        value += vmax.front().second;
        ++count;
        vmax.pop_front();
        if (!vmax.empty())  vmax.pop_front();
      }
      coarse_curve.put(next_i, value/count);
    }
  };

  double ml = 1000.0/vsize[0]/vsize[1]/vsize[2];
  BestIntervalLocator locator(1*ml); // Use 1 ml for window size

  for (int i=0; i<num_of_nodes-1; ++i)
  {
	int ind = solutionOrder[i];
    if (ind == background_node)
    {
      delete[] Lapl_vect;
      delete[] flags;
      return 0.0;
    }
    partition[ind] = 1;
    //sorter.erase(sorter.begin());
    /*==========================================================*/
    /*       Using previous area (x^T)Lx, one can compute:      */
    /*         (x+e_ind)^T L (x e_ind)=                         */
    /*                     (x^T)Lx +                            */
    /*            + [(e_ind^T)Lx + (x^T)L e_ind] +              */
    /*                + (e_ind^T)L e_ind =                      */
    /*         (x^T)Lx + 2*(e_ind)^T Lx + Diag[ind]             */
    /*==========================================================*/
    area += 2*Lapl_vect[ind] + Diagonal[ind];
    if (Weights[6*ind]> 0)
      Lapl_vect[flags[Nodes[ind]-k*l]] -= 1;
    if (Weights[6*ind + 1] > 0)
      Lapl_vect[flags[Nodes[ind]-k]] -= 1;
    if (Weights[6*ind + 2] > 0)
      Lapl_vect[flags[Nodes[ind]-1]] -= 1;
    Lapl_vect[ind] += Diagonal[ind];

    if (Weights[6*ind + 3] > 0)
      Lapl_vect[flags[Nodes[ind]+1]] -= 1;
    if (Weights[6*ind + 4] > 0)
      Lapl_vect[flags[Nodes[ind]+k]] -= 1;
    if (Weights[6*ind + 5] > 0)
      Lapl_vect[flags[Nodes[ind]+k*l]] -= 1;

    locator.put(i, area);
  }
  locator.finish();

  // We assume the aorta root is at least 20 ml (volume of cylinder with diameter 25 and height 30)
  // The upper bound – 500 ml: 300 ml for ascending aorta (cylinder with diameter 50 and height 150)
  //                           and LV volume max 200 ml
  // The interval minimum length is 20 ml
  auto best = locator.bestInterval(20*ml, 500*ml, 20*ml);

  int best_i = best.first;

  if (num_of_nodes > 0 && best_i > 0)
    optimal_tau = double(best_i)/num_of_nodes; // save optimal value for tau
  delete[] Lapl_vect;
  delete[] flags;
  if (Diagonal != nullptr) { delete[] Diagonal; Diagonal = nullptr; }
  return optimal_tau;
}

void IDT::removeVessels(unsigned size)
{
  if (resulting_mask == nullptr) {
	  try {
		  resulting_mask = new bool[n];
	  } catch (std::bad_alloc) {
          throw std::runtime_error ("Bad Alloc IDT.resultingMask");
	  }
  }
  for (int i=0; i<n; ++i)
    resulting_mask[i] = 0;
  for (int i=0; i<num_of_nodes; ++i)
    if (partition[i])
      resulting_mask[Nodes[i]] = 1;
  getDistanceMap(resulting_mask, 0);
  for (int i=0; i<n; ++i)
    if (distanceMap[i]<size)
      resulting_mask[i] = 0;
  getDistanceMap(resulting_mask, 1);

  for (int i=0; i<n; ++i)
    if (distanceMap[i]<size)
      resulting_mask[i] = 1;
}
