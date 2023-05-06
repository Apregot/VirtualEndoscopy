package app

import (
	"github.com/julienschmidt/httprouter"
	"log"
	"net/http"
	"server/internal/dispenser"
)

func Run() {
	router := createRouter()
	log.Fatal(http.ListenAndServe(":80", router))
}

func createRouter() *httprouter.Router {
	router := httprouter.New()
	initPaths(router)
	return router
}

func initPaths(router *httprouter.Router) {
	dispenserHandler := dispenser.Handler{}
	dispenserHandler.Register(router)
	Register(router)
}
