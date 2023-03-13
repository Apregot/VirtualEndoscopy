goog.require('goog.dom');
goog.require('goog.style');

/**
 * Это обработчик меню Файл / Чтение DICOM каталога или Чтение DICOM файла 
 * отдельный файл приходит как FileList[1]
 * @param {FileList} filelist
 *
 * Что умеет: получить AMI.stack и загрузить его в quadview через UP3 
 * с простым рендерингом - ничего в 2D и "покрутить" в 3D
 *
 * Чего не умеет: 1) отделять котлеты от мух, то есть различать файлы DICOM от не-DICOM 
 *  Это делает однако loadLocalFiles, ругаясь на файлы не-DICOM  при парсинге
 *  2) обрабатывать сразу несколько серий в справочнике. Вообще то они читаются все,
 *  но потом делается merge по первому фреймy прочитанного loader'ом, а кто там будет 
 *  первым - одному богу известно
 *  3) красиво изображать дерево DICOM в диалоге а-ля Мультивокс с возможностью выбора серий
 *  4) отсутствует управление enable/disable меню "Initialize FFR processing" (возможно это не его забота)
 *  5) создавать картинки для серии с надписями 
 *  6) в силу такого обширного списка обязанностей имеет смысл выделить в отдельный файл
 * Функцональность "сделай картинку для стека (или фрейма?)" должна быть отдельно, 
 *  так как есть еще прореженные серии, а они вообще к загрузке не относятся
 *
 * Что должен возвращать? Видимо массив стеков серий
 *  
 */

async function handler__loadDICOMFileOrDir(filelist) {
  console.log('handler__loadDICOMFileOrDir()',filelist)

  // testLoadLocalFile(file);
  let series = await loadLocalFiles(filelist);
  // let stack = series.stack[0];
  // let copyData = stack.frame[0].pixelData.slice();
  // console.log('copyData',copyData)
  FFR.viewer.seriesLists.addNewSeries(series);
}

/**
 * Загружает DICOM из списка файлов локальных файлов
 * возвращает стек серии, которая окажется с индексом 0
 * а вот это похоже неопределенная вещь, если в списке 
 * есть несколько серий
 * @param {FileList} filelist
 * @return {*} AMI.SeriesModel
 */ 
async function loadLocalFiles(filelist) {
  let loader = new FileVolumeLoader();
  await loader.load(filelist);

  let series = loader.data[0].mergeSeries(loader.data)[0];
  //--------------------------эксперименты
  // seriesInfo(series);
  //--------------------------
  let stack = series.stack[0];
  stack.prepare();
  return series; 
}



function testSaveCanvasAsPNG(stack) {
  console.log('testSaveCanvasAsPNG()');
  let r3 = document.getElementById('r3');
  let canvas = r3.firstChild;
  // var img    = canvas.toDataURL("image/png");
  // console.log('img',img)  // data:image/png;base64,...39Кб

  let huvR4 = new HUV({left:300, top:200, width:600, height:600, opacity:1});
  // var img = new Image(); img.src = canvas.toDataURL(); 

  let img = thumbAxialSlice(stack);

  huvR4._huv.appendChild(img);
}

/**
 * Возвращает аксиальный Image thumbnail для данного стека размером 128x128 пикселей 
 * с цифрой количества кадров в нижнем правом углу. Картинка делается для фрейма в середине стека
 * @param {*} stack AMI.StackModel
 * @return {Image}
 */
function thumbAxialSlice(stack) {
  const width=128, height=128;
  let div = goog.dom.createDom("div");
  goog.style.setSize(div,width,height);
  document.body.appendChild(div);
  let rx = UP3.enable(div);
  rx.sliceColor = 0x000000;   // у какого-то helper'a есть сеттер для установки цвета рамки
  UP3.initRenderer2D(div);
  rx.sliceOrientation = 'axial'; initHelpersStack(rx,stack);
  // rx.stackHelper.index = 192;    // так можно выставить любой желаемый индекс
  let canvas = rx.domElement.firstChild;
  rx.renderer.render(rx.scene, rx.camera);
  let canvas1 = goog.dom.createDom("canvas");
  goog.style.setSize(canvas1,width,height);
  var ctx = canvas1.getContext('2d');
  ctx.drawImage(canvas,0,0);
  ctx.font = "bold 36px serif";
  ctx.fillStyle = "#ff0000";
  // это в расчете на картинку 128х128
  const n = stack['_numberOfFrames'], xOffset = n < 10 ? 107 : n < 100 ? 90 : n < 1000 ? 70 : 50;
  ctx.fillText(n.toString(), xOffset, 120);
  let img = new Image(); img.src = canvas1.toDataURL();

  // cleanup
  UP3.disable(div);
  document.body.removeChild(div);

  return img;
}

/**
 * В AMI 0.32 серия хранит ссылку на словарь метаданных
 * В исходном коде AMI класс называется ModelsSeries, 
 * а в webpack bundle он называется AMI.SeriesModel
 * @param {*} series !AMI.SeriesModel
 */
function seriesInfo(series) {
  console.log('seriesInfo()',series)
  let metaInfo = series['rawHeader'];
  let stack = series.stack[0];
  console.log('x52009230',metaInfo.elements.x52009230);
  console.log('stack',stack)
  console.log('studyInstanceUID',metaInfo.string('x0020000d'))
  console.log('seriesInstanceUID',metaInfo.string('x0020000e'))
}

/**
 * Извлекает метаинормацию о серии череp DataParser как на картинках Мультивокс
 * В версии AMI 0.23-dev метаинформацию можно было получить только из DataParser,
 * а в AMI 0.32 серия хранит ссылку на словарь метаданных, поэтому эта функция становится излишней 
 * @param {*} dataParser
 */
function seriesInfoUsingDataParser(dataParser) {
  // Томск Im0
  // Номер: (0020,0011 Series Number SN)
  // (0018,0300 Protocol Name PN): 5.25 Calcium Scoring + Coronary Artery 30-70 BPM  --пока непонятно как достать
  // (0008,103E Series Description SD): SS Segment 30-74.. --это есть
  // this._dataSet.string('x0020000e');

  console.log('Series Number SN',dataParser._dataSet.string('x00200011'))
  console.log('Protocol Name PN',dataParser._dataSet.string('x00181030'))
  console.log('Series Description SD',dataParser._dataSet.string('x0008103e'))
  console.log('seriesInstanceUID',dataParser._dataSet.string('x0020000e'))

  // let series = loader.data[0].mergeSeries(loader.data)[0];
      // dmi.seriesInstanceUID = series.seriesInstanceUID; // x0020000e
      // dmi.transferSyntaxUID = series.transferSyntaxUID; // x00020010
      // dmi.seriesDate = series.seriesDate;               // x00080021
      // dmi.seriesDescription = series.seriesDescription; // x0008103e
      // dmi.studyDate = series.studyDate;                 // x00080020
      // dmi.studyDescription = series.studyDescription;   // x00081030
      // dmi.numberOfFrames = series.numberOfFrames;
      // dmi.numberOfChannels = series.numberOfChannels;
      // dmi.modality = series.modality;                   // x00080060
      // dmi.patientID = series.patientID;                 // x00100020
      // dmi.patientName = series.patientName;             // x00100010
      // dmi.patientAge = series.patientAge;               // x00101010
      // dmi.patientBirthdate = series.patientBirthdate;   // x00100030
      // dmi.patientSex = series.patientSex;               // x00100040

}