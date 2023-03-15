goog.require('goog.object');
goog.require('goog.dom');
goog.require('goog.style');
goog.require('goog.ui.Component');

class HUV {
	constructor(props) {
		const left = (props.left || 20), top = (props.top || 20), width = (props.width || 100), height = (props.height || 50);
		const background = (props.background || '#ffffff'), opacity = (props.opacity || 0.5);
		const huvStyle = `z-index: 2000; position: absolute; left:${left}px; top:${top}px; background:${background}; opacity:${opacity};color:black`;
		// console.log('huvStyle',huvStyle)
		let closeEl = goog.dom.createDom("div",{"class":"modal-dialog-title-close"});
		this._id = new goog.ui.Component().makeId('huv'); 
		this._innerEl = goog.dom.createDom("div");
		this._huv = goog.dom.createDom("div",{"style": huvStyle, "id": this._id}, closeEl, this._innerEl);
		goog.style.setSize(this._huv,width,height);
		document.body.appendChild(this._huv);

		let onPointerDownPointerX, onPointerDownPointerY;
		let self = this;
		function onMouseDown( event ) {
			// console.log('onMouseDown',event.clientX,event.clientY)
			onPointerDownPointerX = event.clientX;
			onPointerDownPointerY = event.clientY;
			self._huv.addEventListener( 'mousemove', onMouseMove, false );
			self._huv.addEventListener( 'mouseup', onMouseUp, false );
		}
		function onMouseMove( event ) {
			// console.log('onMouseMove',event.clientX,event.clientY)
			let pos = goog.style.getPosition(self._huv);
			let dx  = ( event.clientX - onPointerDownPointerX );
			let dy  = ( event.clientY - onPointerDownPointerY );
			onPointerDownPointerX = event.clientX; onPointerDownPointerY = event.clientY;
			pos.x += dx;
			pos.y += dy;
			goog.style.setPosition(self._huv,pos);
		}
		function onMouseUp( event ) {
			// console.log('onMouseUp',event.clientX,event.clientY)
			self._huv.removeEventListener( 'mousemove', onMouseMove, false );
			self._huv.removeEventListener( 'mouseup', onMouseUp, false );
		}

		this._huv.addEventListener( 'mousedown', onMouseDown, false );

		closeEl.onclick = ()=>this.dispose();

	}

	setText(text) { this._innerEl.innerHTML = text; }
	clearText() { this.setText('') }
	getId() { return this._id; }
	 

	dispose() {
		// console.log('HUV::dispose()')
		this._huv.parentElement.removeChild(this._huv);
	}
}


// goog.style.setSize(this.dialog.getContentElement(),w,h)

// .style.background = color .style.background = '#909090'
// <div id="ThreeJS" style="z-index: 1; position: absolute; left:0px; top:0px"></div>
// #info {
// 	position: absolute;
// 	top: 0px;
// 	width: 100%;
// 	padding: 10px;
// 	box-sizing: border-box;
// 	text-align: center;
// 	-moz-user-select: none;
// 	-webkit-user-select: none;
// 	-ms-user-select: none;
// 	user-select: none;
// 	pointer-events: none;
// 	z-index: 1; /* TODO Solve this in HTML */
// }
