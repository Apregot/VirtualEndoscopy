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
	handler := dispenser.Handler{}
	handler.Register(router)

	// Для тестирования работы сервера
	router.GET("/", func(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
		writer.Write([]byte("Sockets works!(And deploy. Attempt 5)"))
	})
}
