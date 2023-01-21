goog.require('goog.ui.Component');
goog.require('goog.math.Size');
goog.require('goog.ui.SplitPane');
goog.require('gfk.ui.SplitPaneExpanded');
goog.require('gfk.ui.TabBar');

class VesselHistogramComponent extends goog.ui.Component {

    /**
     * @param {*} parent - это ссылка на MarkStenosisComponent
     */
    constructor(parent) {
        super();
        // console.log('VesselHistogramComponent()')
        // state={stack,aortaCube,[v0Cube,v1Cube], vesselInfo=[{name,burificationPoints,centerline{Float64Array}}]}
        this._state = parent._state;
        this._parent = parent;

        this.svg = null;
        this._onion = new Onion(this._state);
        this.dataset1 = [ 5, 10, 13, 19, 21, 25, 22, 18, 15, 13, 11, 12, 15, 20, 18, 17, 16, 18, 23, 25 ];                       
        this._selectedVessel = null;
        this._state.vesselInfo.forEach(vessel => vessel.tubes = [])
    }

    /** @override */
    createDom() {
      // console.log('VesselHistogramComponent::createDom()')
      super.createDom();
      this.getElement().style.height = "100%";
      let element = this.getElement();
      //element.id = 'myDiv1';
      //let div = document.getElementById('myDiv1'); console.log('div',div)
      let html = `<div id="myDiv1" style="width:100%; height:100%; background:#ccc;"></div>`;
 // let html = `<div style="height:100%; background:#ddd; display:flex; flex-direction:column; justify-content:space-between;">
 //      <button style="width:100%">Удалить сосуд</button>
 //      <div id="myDiv1" style="width:100%; height:90%; background:#ccc; flex-grow: 1;"></div>
 // </div>`;

      element.innerHTML = html;
      //   
    }

    enterDocument() {
      //console.log('VesselHistogramComponent::enterDocument()')
      super.enterDocument(); //return;
      let sel = d3.select("div#myDiv1"); //console.log('sel',sel)

      var wSvg = 500, hSvg = 250; 
      var margin = 20, w = wSvg-margin, h = hSvg-margin, padding = 20;     
      let div1 = document.getElementById("myDiv1"); //console.log('div1',div1)
      w = goog.style.getSize(div1).width;
      h = goog.style.getSize(div1).height; //console.log('h',h)

      this.svg = d3.select("div#myDiv1")
                  .append("svg")
                  .attr("width", "100%")
                  .attr("height", h);

      // только сейчас можно объявить родителю, что я существую
      // это вызовет callback на setSelectedVessel()

      this._parent.vesselHistogramComponent = this;
    }


    /**
     * @param {*} vessel - это ссылка на объект VesselInfo
     */
    buildHistogram(vessel) {
      const vesselStenosis = this._state._stenosisList.filter(el => el.vessel == vessel)
      const dataset = vessel.profile;
      const self = this;
      this.svg.selectAll('rect').remove();

      let div1 = document.getElementById("myDiv1"); //console.log('div1',div1)
      let w = goog.style.getSize(div1).width;
      let h = goog.style.getSize(div1).height; //console.log('h',h)

      var xScale = d3.scaleBand()
                      .domain(d3.range(dataset.length))
                      .range([0, w])
                      .paddingInner(0.05);
      var yScale = d3.scaleLinear()
                      .domain([0, d3.max(dataset)])
                      .range([0, h]);


      this.svg.selectAll("rect")
         .data(dataset)
         .enter()
         .append("rect")
         .attr("x", function(d, i) {
              return xScale(i);
          })
         .attr("fill", function(d, i) {
            // определяем, принадлежит ли i какой-то tube
            const tube = vessel.tubes.find(tube => tube.range[0] <= i && i <= tube.range[1])
            return (!tube ? "teal" : tube.stenosis ? tube.stenosis.color : "white")
          })
         .attr("y", function(d) {
              return h-yScale(d);
         })
         .attr("width", xScale.bandwidth())
         .attr("height", function(d) {
              return yScale(d);
          })
         .on("click", (d,i) => this.onClick( d, i)         
          );

         this.svg.selectAll("rect")
           .append('title')
           .text(function(d,i) {
              let dist = self.segmentLength(i).toFixed(1);
              const D = (vessel.profile[i]*2).toFixed(1);
              let tip = `сегмент ${i}:\nдлина ${dist} мм\nдиаметр ${D} мм`;
              return tip;
           });
    }

    /**
     * @param {Number} vesselInd - индекс выбранного сосуда в MarkStenosisComponent
     */
    setSelectedVessel(vesselInd) {
        // console.log(`setSelectedVessel(${vesselInd})`)
        this._selectedVessel = this._state.vesselInfo[vesselInd];
        if(!this._selectedVessel.profile) { 
          // console.log('вычисляем профиль сосуда в первый раз')  
          this._selectedVessel.profile = this._onion.vesselProfile(vesselInd); //console.log('profile', profile)
        }
        else {
          // console.log('профиль сосуда уже вычислен')
        }

        this.buildHistogram(this._selectedVessel);
        this._parent._manageButtonState()
    }

    // возвращает длину сегмета в мм
    // 
    segmentLength(ind) {
      const centerline = this._selectedVessel.centerline;
      let c0 = new THREE.Vector3(centerline[3*ind],centerline[3*ind+1],centerline[3*ind+2]);
      let c1 = new THREE.Vector3(centerline[3*(ind+1)],centerline[3*(ind+1)+1],centerline[3*(ind+1)+2]);
      return c0.distanceTo(c1);
    }

    // {PointerEvent} d3.event 
    onClick(d, i) {
      //console.log('onClick', performance.now())
      this.processClickOnHistogramBar(this._selectedVessel, i)

      // это пример как использовать cntrl-click
      // this._state._vMesh[1].visible = false;
      // if(d3.event.ctrlKey) console.log('cntrl-click',d3.event)
      // this.svg.selectAll("rect").each((d,i,nodes) => {
      //   // console.log(d,i,nodes)
      //   if (i % 2 == 0) {
      //     nodes[i].setAttribute("fill", "pink");
      //   }
      // });
    }


    _addTube(vessel, range) {
        // console.log(`создаем новый tube [${range[0]},${range[1]}]`)
        const mesh = Tubes.makeTubeMesh({vessel:vessel, range:range, radius:0.6});
        this._parent.visArea.scene.add(mesh);
        vessel.tubes.push({range:range, mesh: mesh, stenosis: null})
    }

    _removeTube(vessel, tube) {
      console.assert(!tube.stenosis, 'функция_removeTube не может удялять стенозы')
      if(tube.stenosis) return;
      this._parent.visArea.scene.remove(tube.mesh);
      const ind = vessel.tubes.indexOf(tube)
      ind != -1 && vessel.tubes.splice(ind,1)
    }

    _rebuildTube(vessel,tube) {
      const color = tube.stenosis ? tube.stenosis.color : 0xffffff;
      this._parent.visArea.scene.remove(tube.mesh)
      tube.mesh = Tubes.makeTubeMesh({vessel:vessel, range:tube.range, radius:0.6, color:color});
      this._parent.visArea.scene.add(tube.mesh);
    }

    // нельзя объединять 2 стеноза
    // стеноз поглощает не-стеноз
    //
    _mergeTubes(vessel,tubes) {
      console.assert(!tubes[0].stenosis || !tubes[1].stenosis,'два стеноза не объединяются')
      if(tubes[0].stenosis && tubes[1].stenosis) return;
      // tube1 - куда будем вливаться
      const tube1 = tubes[0].stenosis ? tubes[0] : tubes[1]
      const tube2 = tubes[0].stenosis ? tubes[1] : tubes[0]
      tube1.range[0] = Math.min(tube1.range[0], tube2.range[0])
      tube1.range[1] = Math.max(tube1.range[1], tube2.range[1])

      this._removeTube(vessel,tube2)
      this._rebuildTube(vessel,tube1)
    }

    // vessel - элемент state.vesselInfo[]
    processClickOnHistogramBar(vessel, i) {
      const inTube = vessel.tubes.find(tube => tube.range[0] <= i && i <= tube.range[1])
      const becomeSelected = (!inTube)
      //console.log(`processClickOnHistogramBar(${i})`) 
      let selection = d3.select(this.svg.selectAll('rect').nodes()[i]);

      // то есть пожалуй случаи select/deselect(i) бывают такие
      // под tube понимается диапазон селектированных столбиков, то есть либо стеноз, либо белый (незахваченный)
      // (1) одиночный свободный, то есть не находится внутри и не примыкает к какой-то tube 
      // (2) примыкает слева/справа к tube, но не перемычка (случай 4)
      // (3) внутри tube a) tube.lenght==1 b) tube.length > 1
      // (4) перемычка между двух tube
      // действия:
      // (1)-select: new tube [i,i]  needReduildHistogram; 
      // (1)-deselect: это случай 3a
      //   delete tube, needReduildHistogram 
      // (2)-select расширить tube, needReduildHistogram 
      // (2)-deselect сузить tube, если столбиков остается больше 0, иначе ругнуться
      // (3)-deselect если tube белая, то разделить на 2, нет белый tube не делим, иначе ругнуться
      // (4)-select (обединение): a) если оба белых, то объединить в одну белую
      //  b) если белый и цветной, то объединить с цветным с) если 2 цветных, то ругнуться 
      //
      // то есть processClickOnHistogramBar отвечает за разделение/слияние/обновление диапазонов
      // и перестройку tube mesh, а раскраску отдает в buildHistogram
      // 

      const joinTubes = vessel.tubes.filter(tube => tube.range[0]-1 <= i && i <= tube.range[1]+1)

      // случай (4) перемычка между двух tube
      if(joinTubes.length == 2) {

        // console.log('обнаружен случай 4 (перемычка между двумя tubes)', joinTubes);
        if(joinTubes[0].stenosis && joinTubes[1].stenosis) {
          alert('нельзя объединять два стеноза')
          return;          
        }

        this._mergeTubes(vessel,joinTubes)
      }
      // случаи (2) внутри или (3) примыкает
      else if(joinTubes.length == 1) {
        const tube = joinTubes[0]

        // у стеноза и не-стеноза нельзя деселектировать никакой внутренний столбик
        let notAllowed = (tube.range[0] < i && i < tube.range[1]) 
        if(notAllowed) {
          alert('стеноз можно только расширять или сужать')
          return;
        }

        // одиночный белый столбик можно удалять

        if(tube.range[1] - tube.range[0] == 0 && !tube.stenosis && inTube) {
          // console.log('удаляем одиночный белый столбик')
          this._removeTube(vessel,tube)
        }
        else {
          // осталось только сужение/расширение 
          const expand = (tube.range[0]-1 == i || i == tube.range[1]+1) && becomeSelected
          const shrink = (tube.range[0] == i || i == tube.range[1]) && !becomeSelected
          // console.log(`сужение/расширение tube ${expand || shrink}`)
          console.assert(expand || shrink,'сужение/расширение tube ')

          if(becomeSelected) {
            if(i == tube.range[0]-1)        tube.range[0] = i 
            else  if(i == tube.range[1]+1)  tube.range[1] = i 
          }
          else {
            if(i == tube.range[0])        tube.range[0]++ 
            else  if(i == tube.range[1])  tube.range[1]-- 
          }

          this._rebuildTube(vessel,tube);
        }
      }
      else {
        // console.log('обнаружен случай 1-select (одиночный свободный столбик)');

        this._addTube(vessel,[i,i])
      }

      this.buildHistogram(vessel)
      this._parent._manageButtonState()
    }

    setVisible(vis) {
      this.getElement().style.display = vis ? 'block': 'none';
    }

    isVisible() {
      return this.getElement().style.display !== 'none';
    }

    print() {
        console.log('myId '+this.getId());
    }

    resize() {
      //console.log('VesselHistogramComponent::resize()')
    }    
}

FFR.ui.VesselHistogramComponent = VesselHistogramComponent;

var div_vis_fake = `<div id="div_vis_grid">
    <div class="grid_row">
      <div style="color:white">Стандартный:</div>
      <div style="display:flex; justify-content:space-between;">
        <select id="sel1"">
          <option>Realistic</option>
          <option>Cardio</option>
        </select>
        <button>Ред.</button>
      </div>
    </div>

    <div class="grid_row">
      <div style="color:white;">Освещение:</div>
      <div style="display:flex;"><input type="checkbox" name="b"><div id="s12" style="flex-grow:2;"></div></div>    
    </div>

    <div class="grid_row">
      <div style="color:white;">Уровень:</div>
      <div id="s13"></div>
    </div>

    <div class="grid_row">
      <div style="color:white;">Порог:</div>
      <div id="s14"></div>
    </div>

    <div class="grid_row">
      <div style="color:white;">Прозрачность:</div>
      <div id="s15"></div>
    </div>

    <div class="grid_row">
      <div style="color:white;">X границы:</div>
      <input type="text" name="a">     
    </div>
    <div class="grid_row">  
      <div style="color:white;">Y границы:</div>
      <input type="text" name="b">
    </div>
    <div class="grid_row">  
      <div style="color:white;">Z границы:</div>
      <input type="text" name="b">
    </div>
    <div class="grid_row">  
      <div style="color:white;">Тип выреза:</div>
      <select id="sel2">
        <option>Без выреза</option>
        <option>Углом</option>
        <option>Передней плоскотью</option>
      </select>
    </div>`;
