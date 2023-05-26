package app

import (
	"github.com/julienschmidt/httprouter"
	"log"
	"net/http"
	"os"
	"server/internal/logger"
)

const (
	assetsPath = "./dist/assets/"
	imagesPath = "./dist/images/"
	indexPath  = "./dist/index.html"
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
	b, err := os.ReadFile(indexPath)
	if err != nil {
		logger.WriteToLog(err.Error())
		log.Println(err)
		b = []byte("Internal server error")
	}
	_, err = writer.Write(b)
	if err != nil {
		logger.WriteToLog("[APP: GET INDEX ERROR]" + err.Error())
	}
}

func getAssets(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	asset := params.ByName("asset")
	if asset[len(asset)-3:] == "css" {
		writer.Header().Set("Content-Type", "text/css")
	} else {
		writer.Header().Set("Content-Type", "application/javascript")
	}
	b, err := os.ReadFile(assetsPath + asset)
	if err != nil {
		logger.WriteToLog(err.Error())
		panic(err)
	}
	_, err = writer.Write(b)
	if err != nil {
		logger.WriteToLog("[APP: GET ASSETS ERROR]" + err.Error())
	}
}

func getImage(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	image := params.ByName("image")
	b, err := os.ReadFile(imagesPath + image)
	if err != nil {
		logger.WriteToLog(err.Error())
		panic(err)
	}
	_, err = writer.Write(b)
	if err != nil {
		logger.WriteToLog("[APP: GET IMAGE ERROR]" + err.Error())
	}
}
