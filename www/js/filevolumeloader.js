/**
 *  Этот класс расширяев AMI.VolumeLoader возможностью загружать локальные файлы
 */

 class FileVolumeLoader extends AMI.VolumeLoader {

 	constructor() {
 		super();
 		this._dataParser = null;	// инициализируется при перехвате parseFrame
 	}

 	get dataParser() {
 		return this._dataParser;
 	}

 	fetch(url, requests) {
 		// console.log('FileVolumeLoader::fetch()',url);
		return new Promise((resolve, reject) => {
			var fr = new FileReader();
			fr.onload = (event) => {
				let buffer = fr.result;
				let response = {
					url,
					buffer,
				};
				resolve(response);
			}
			fr.readAsArrayBuffer(url);
		});
 		// return super.fetch(url, requests);
 		// return Promise.reject();
 	}

  /**
   * load the data by url(urls)
   * @param {File|FileList} url 
   * @param {Map=} requests - used for cancellation.
   * @return {Promise}
   */
	load(url, requests) {
 		console.log('FileVolumeLoader::load()',url);
	    let arrFiles = []
	    if (url instanceof File) {
	      arrFiles.push(url);
	    }
	    else if(url instanceof FileList)
	    	for(var i=0; i<url.length; i++)
	    		arrFiles.push(url[i]);

	    const loadSequences = [];
	    arrFiles.forEach((file) => {
	      if (!Array.isArray(file)) {
	        loadSequences.push(
	          this.loadSequence(file, requests)
	        );
	      } else {
	        loadSequences.push(
	          this.loadSequenceGroup(file, requests)
	        );
	      }
	    });
	    return Promise.all(loadSequences);
  	}

  	/**
  	 *  Этот метод введен исключительно для перехвата параметров
  	 *  мне нужен dataParser
  	 */
  	parseFrame(series, stack, url, i, dataParser, resolve, reject) {
  		this._dataParser = dataParser;
  		super.parseFrame(series, stack, url, i, dataParser, resolve, reject);
  	}
 }

function testLoadLocalFile(file) {
	console.log('testLoadLocalFile',file);
	let loader = new FileVolumeLoader();  // let loader = new AMI.VolumeLoader();
	// let files = ['http://localhost/Почукаева/DICOM/PA1/ST1/SE2/IM1'];
	// let files = ['d:/Data/test_meta_DICOM/IMG-0003-00001.dcm'];
	loader.load(file)
	.then(function() {
	  console.log("Метаданные получены loader.data=",loader.data);
	  let series = loader.data[0].mergeSeries(loader.data)[0];
	  console.log('series=',series)
	  let stack = series.stack[0];
	  stack.prepare();
	  console.log('stack=',stack)
	})
	.catch(function(error) {
	window.console.log('oops... something went wrong...');
	window.console.log(error);
	});
}

