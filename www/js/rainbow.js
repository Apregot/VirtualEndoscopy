// Раскраска сосудов значением ФРК

function rainbow(state) {
	console.log('rainbow()')
}


/** 
 * Функция возвращает FFRfull.tre в виде объекта
 * 
 * @return {*} объект
 * {
 *   LCA:[ {step:Number, ffr_value:[Number..]} ]	// индекс в массиве соответствует индексу ребра в input_data
 *   RCA:[ {step:Number, ffr_value:[Number..]} ]
 * }
 * 
 * если произошла ошибка, то возвращается объект {error: response.status|text}
 * 
 */ 	
async function parse_FFRfull() {
	const URL = 'bin/FFR/FFRfull.tre'
	let response = await fetch(URL);
	let FFRfull = {};

	if (!response.ok) return {error: response.status};
	let text = await response.text();
	let lines = text.split(/\r?\n/);
	/*
		новый формат в 1.2.4.72
		парсинг файла FFRfull.tre
		4 строчки игнорирум
		LCA
		ID
		шаг
		число сегментов
		Qave				--игнорируем
   		1.55402829311412    --игнорируем
 		FFR 				--игнорируем
		ФРК[] массив значений ФРК на сегменте
		RCA
		структура аналогичная LCA
	*/
	let ind = 4 /*индекс текущей строки*/, section, section_data = []
	while(ind < lines.length) {
		if(lines[ind] == '') {ind++; continue;}
		if(lines[ind] == ' LCA' || lines[ind] ==' RCA') {
			section = lines[ind] == ' LCA' ? 1 : 2;
			if(section == 2) {
				FFRfull.LCA = section_data;
				section_data = [];
			}
			ind++;
			continue;
		}
		//return {error: `line ${ind}`, line:lines[ind]};
		const ID = parseInt(lines[ind]);	
		const step = parseFloat(lines[++ind]);
		const nn = parseInt(lines[++ind]);
		let ffr_values = [];
		ind += 3;
		for(let i=0; i<nn; i++) 
			ffr_values.push(parseFloat(lines[++ind]));
		section_data.push({step:step, ffr_value:ffr_values});
		ind++;
		//console.log(ID,step,nn,ffr_values); break;

		//console.log(section_data)

	}
	FFRfull.RCA = section_data;

	return FFRfull;
}

/** 
 * Функция возвращает input_data.tre в виде объекта
 * 
 * @return {*} объект
 * {
 *   LCA:{nodes:[[x,y,z]], ribs:[{i1,i2,segLength,diameter}]}, i1 и i2 являются индексами по nodes, то есть 0-based
 *   RCA:{nodes:[], ribs:[{n1,n2,segLengthCM,segDiameterCM}]}, а не 1-based, как ID узлов и ребер в input_data.tre, т.е. ind = ID-1
 *   stenosis: [{branch:1-LCA| 2-RCA, ribIndex, type }]
 * }
 * 
 * если произошла ошибка, то возвращается объект {error: response.status|text}
 * 
 */ 	
async function parse_input_data() {
	const URL = 'bin/FFR/input_data.tre'
	let response = await fetch(URL);
	let input_data = {};

	if (!response.ok) return {error: response.status};
	let text = await response.text();
	let lines = text.split(/\r?\n/);
	/*
		парсинг файла input_data.tre
		первые 2 строки: <nodesCnt>	<ribsCnt>
		LCA <6> число узлов вида {ind,[x y x], 1|2} каждый на своей строке, ind начинается с 1, 1|2 - node degree
		RCA ..
		LCA ribs:
		5 			число ребер LCA
		1 			ID ребра
		1 2          ID левого и правого узла LCA (будут хранться как индексы, индекс = ID-1)
		0.114551		длина ребра в см
		0.256646		диаметр ребра в см
		10 			что то непонятное
		...			всего 5 записей
		RCA ribs: 	структура аналогича LCA
		список стенозов:
		1 			число стенозов
		2            ID артерии LCA - 1| RCA - 2
		4 			ID ребра 
		1            тип
	*/
	// обрабатываем секции LCA nodes и RCA nodes
	let ind = 2;	// индекс текущей строки
	for(let section=1; section<=2; section++) {
		const nn = parseInt(lines[ind]);
		if (isNaN(nn)) return {error: `line ${ind}`};
		let nodes = [];
		ind++;
		for(let i=0; i<nn; i++) {
			if(parseInt(lines[ind])-1 != nodes.length)
				return {error: `line ${ind}`};
			let xyz = lines[ind+1].split(' ');
			if(xyz.length != 3)
				return {error: `line ${ind}+1`};
			nodes.push([parseFloat(xyz[0]),parseFloat(xyz[1]),parseFloat(xyz[2])]);
			ind += 3;	// node degree игнорируем
		}
		//console.log(lines)
		if(section == 1)
			input_data.LCA = {nodes:nodes};
		else
			input_data.RCA = {nodes:nodes};
	}

	// обрабатываем секции LCA ribs и RCA ribs
	for(let section=1; section<=2; section++) {
		const nn = parseInt(lines[ind]);
		if (isNaN(nn)) return {error: `line ${ind}`};
		let ribs = [];
		ind++;
		for(let i=0; i<nn; i++) {
			if(parseInt(lines[ind])-1 != ribs.length)
				return {error: `line ${ind}`};
			let _12 = lines[ind+1].split(' ');
			if(_12.length != 2)
				return {error: `line ${ind}+1`};
			let rib_length = parseFloat(lines[ind+2])
			let rib_diameter = parseFloat(lines[ind+3])
			ribs.push({
				n1:parseInt(_12[0])-1,
				n2:parseInt(_12[1])-1,
				segLengthCM: rib_length,
				segDiameterCM: rib_diameter,
				plasticTube: null,				// mesh трубки, раскрашенной значением FFR
			});
			ind += 5;	// node degree игнорируем
		}
		//console.log(lines)
		if(section == 1)
			input_data.LCA.ribs = ribs;
		else
			input_data.RCA.ribs = ribs;
	}

	// секция стенозов
	const nn = parseInt(lines[ind]);
	let stenosis = [];
	for(let i=0; i<nn; i++) {
		stenosis.push({
			branch:  parseInt(lines[ind+1]), 
			ribIndex:parseInt(lines[ind+2])-1,
			type: 	 parseInt(lines[ind+3]),		
		})
	}
	input_data.stenosis = stenosis;

	return input_data;
}



// эксперименты

var RainbowObj = function(state) {
	this.state = state;
}

RainbowObj.prototype.parse = async function () {
	console.log('RainbowObj.parse()', this.state)
}