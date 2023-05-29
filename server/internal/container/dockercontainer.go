package container

import (
	"bytes"
	"log"
	"net"
	"os/exec"
	"server/internal/logger"
	"strconv"
	"strings"
	"time"
)

type DockerContainer struct {
	Id   string
	Port uint16
}

const (
	ImageName = "pea/atb:latest"
	AtbPort   = "8889"
	LifeTime  = time.Minute * 5
)

func UpDockerContainer() DockerContainer {
	port, err := getFreePort()
	if err != nil {
		logger.WriteToLog("[DOCKER CONTAINER: GET FREE PORT ERROR] " + err.Error())
	}
	cmd := exec.Command(
		"docker",
		"run",
		"-d",
		"-p",
		strconv.FormatUint(uint64(port), 10)+":"+AtbPort,
		ImageName,
	)
	var out bytes.Buffer
	cmd.Stdout = &out
	err = cmd.Run()
	if err != nil {
		logger.WriteToLog("[DOCKER CONTAINER: RUN ERROR] " + err.Error())
		log.Fatal(err)
	}
	id := strings.TrimSuffix(out.String(), "\n")

	container := DockerContainer{Id: id, Port: port}
	logger.WriteToLog("[DOCKER CONTAINER] Created container Id: " + container.Id)

	return container
}

func getFreePort() (uint16, error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return uint16(l.Addr().(*net.TCPAddr).Port), nil
}
