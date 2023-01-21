class Dialog8 {
  /**
   * Dialog-8: Диалог с кружком аорты
   * @param {*} stack AMI.StackModel
   * @param {!Blob} imgBlob
   * @param {!Float64Array} circles в виде 4-к (center, radius)
   */
    constructor(stack, imgBlob, circles) { // center, radius
        // console.log('new FFR.Dialog8()')
        this.stack = stack;
        this._imgSrc = URL.createObjectURL(imgBlob);
        this._circles = circles;
        this._selectedIndex = -1;

        this.dialog = new gfk.ui.Dialog();
        let component = this.dialog.dialog;
        this.dialog.setContentBackground('#fff');
        this.id1 = component.makeId('d8');
        let dcont=`<div style="position:relative; width:512px; height:512px;">
<div style="position: absolute; top:0;"><img src="${this._imgSrc}"/></div>
<canvas style="position: absolute; top:0;" width="512" height="512" id=`+this.id1+`></canvas>
</div>`;
        this.dialog.setContent(dcont);
        this.dialog.setTitle('AortaForm');
        this.dialog.setTitleBackground('#fff');
        let buttonSet = new goog.ui.Dialog.ButtonSet();
        buttonSet.addButton({caption:'Accept', key:'OK'},true); // default
        buttonSet.addButton({caption:'Reject', key:'CANCEL'},false,true);
        buttonSet.addButton({caption:'Указать другой центр аорты', key:'PICK'},false,false);
        this.dialog.setButtonSet(buttonSet);
        if(this._circles.length == 0) {
            buttonSet.setButtonEnabled('OK',false)
            buttonSet.setButtonEnabled('PICK',false)
        }
        this.ijkCenter  = null;
        this.drawCircles(0);
    }

    /**
     *  Возврат выбранного кружка в виде {center:Vector3, radius} или null
     *  @return {*} 
     */
    getSelectedCircle() {
        if(this._selectedIndex == -1) return null;
        const i = this._selectedIndex, cc = this._circles
        return {
            center: new THREE.Vector3(cc[4*i+0], cc[4*i+1], cc[4*i+2]),
            radius:cc[4*i+3]
        }
    }

    /**
     *  Рисование кружков аорты на IMG 
     *  Основной кружок рисуется сплошной линией, а альтернативные пунктирной
     *  @param {!number=} selectedIndex основной кружок
     */
    drawCircles(selectedIndex) {
        // console.log(`drawCircles(${selectedIndex})`)
        const cc = this._circles, numCircles = this._circles.length / 4
        if(numCircles == 0) return;

        this._selectedIndex =  selectedIndex;

        let canvas = document.getElementById(this.id1);
        const context = canvas.getContext('2d');
        context.clearRect(0,0,canvas.width,canvas.height)

        for(let i = 0; i < numCircles; i++) {
            const center = new THREE.Vector3(cc[4*i+0], cc[4*i+1], cc[4*i+2]), radius = cc[4*i+3]
            //console.log('center',center,radius)
            this.ijkCenter = new THREE.Vector3().copy(center).applyMatrix4(this.stack.lps2IJK);
            
            // посчитаем радиус в IJK
            let rr = new THREE.Vector3(center.x+radius, center.y, center.z);
            let rad = new THREE.Vector3().copy(rr).applyMatrix4(this.stack.lps2IJK);
            const ijkRadius = rad.x-this.ijkCenter.x; //console.log('ijkRadius=',ijkRadius);
            
            const centerX = Math.round(this.ijkCenter.x); //167; 
            const centerY = Math.round(this.ijkCenter.y); //257; 
            // let xScale=300/512, yScale=150/512;
            // const c_x=centerX*xScale, c_y=centerY*yScale, c_rx=radius*xScale, c_ry=radius*yScale;

            context.beginPath();
            context.arc(centerX, centerY, ijkRadius, 0, 2 * Math.PI, false);
            if(i == this._selectedIndex) {
                context.lineWidth = 3;
                context.setLineDash([]);        // solid line
            }
            else {
                context.lineWidth = 2;
                context.setLineDash([5, 5]);    // dashed line   
            }
            context.strokeStyle = 'red';
            context.stroke();
        }
    }

    onButtonPickCenter() {
        // console.log('нажата кнопка выбрать новый центр среза аорты')
        let canvas = document.getElementById(this.id1);
        canvas.style.cursor = "url('img/pan-cursor.cur'), crosshair"
        this.dialog.dialog.getButtonSet().setButtonEnabled('PICK', false); 

        var canvasOffset = getOffsetRect(canvas);

        canvas.addEventListener('mousedown', event => {
            const x = event.clientX - canvasOffset.left
            const y = event.clientY - canvasOffset.top
            //console.log(`(${x},${y})`, this.aortaCenter, this.ijkCenter)
            // let ijk = AMI.UtilsCore.worldToData(this._stack.lps2IJK, axPosition)
            let posClick = new THREE.Vector3(x,y,this.ijkCenter.z).applyMatrix4(this.stack.ijk2LPS);
            // console.log(`posClick=(${posClick.x},${posClick.y},${posClick.z})`)

            const cc = this._circles, numCircles = this._circles.length / 4
            let i, found = false
            for(let i = 0; i < numCircles; i++) {
                const center = new THREE.Vector3(cc[4*i+0], cc[4*i+1], cc[4*i+2]), radius = cc[4*i+3]
                if(center.distanceToSquared(posClick) <= radius*radius) {
                    // console.log(`попали в ${i+1} круг`);
                    found = true;
                    this.drawCircles(i);
                    break;
                }                
            }

            // if(!found)
            //     console.log(`не попали`)
        });


    }

    exec(f) {
        this.dialog.listen(e => {
            // console.log(e.key); 
            if(e.key == 'PICK') {
                this.onButtonPickCenter();
                return false;
            }

            f(e.key)            
        });

        this.dialog.show();
        // Это не срабатывает, слишком рано, надо либо ловить CLOSE от диалога, 
        // либо начихать на возможную утечку памяти. 80Кб - на картинку ерунда
        // console.log('revoking..')
        // URL.revokeObjectURL(this._imgSrc);
    }
 }

