package app

import (
	"github.com/julienschmidt/httprouter"
	"net/http"
	"io/ioutil"
)

const (
	assetsPath = "./dist/assets/"
	imagesPath = "./dist/images/"
)

type Handler interface {
	Register(router *httprouter.Router)
}

func Register(router *httprouter.Router) {
	router.GET("/", getIndex)
	router.GET("/assets/:asset", getAssets)
	router.GET("/images/:image", getImage)
}

func getIndex(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	b, err := ioutil.ReadFile("./dist/index.html")
	if err != nil {
		panic(err)
	}
	writer.Write([]byte(b))
}

func getAssets(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	asset := params.ByName("asset")
	if asset[len(asset)-3:] == "css" {
		writer.Header().Set("Content-Type", "text/css")
	} else {
		writer.Header().Set("Content-Type", "application/javascript")
	}

	b1, err := ioutil.ReadFile(assetsPath + asset)
	if err != nil {
		panic(err)
	}
	writer.Write([]byte(b1))
}

func getImage (writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	image := params.ByName("image")

	b1, err := ioutil.ReadFile(imagesPath + image)
	if err != nil {
		panic(err)
	}
	writer.Write([]byte(b1))
}