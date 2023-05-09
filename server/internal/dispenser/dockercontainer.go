package dispenser

import (
	"bytes"
	"fmt"
	"log"
	"net"
	"os/exec"
	"server/internal/logger"
	"strconv"
	"strings"
	"time"
)

type DockerContainer struct {
	Port uint16
}

const imageName = "pea/atb:latest"

func UpDockerContainer() DockerContainer {
	dropOldContainers()
	port, err := getFreePort()
	if err != nil {
		logger.WriteToLog(err.Error())
		log.Fatal(err)
	}
	cmd := exec.Command("docker", "run", "-d", "-p", strconv.FormatUint(uint64(port), 10)+":8889", imageName)
	var out bytes.Buffer
	cmd.Stdout = &out
	err = cmd.Run()
	if err != nil {
		logger.WriteToLog(err.Error())
		log.Fatal(err)
	}

	container := DockerContainer{Port: port}
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

func dropOldContainers() {
	// команда для вывода списка контейнеров
	getContainersCmd := exec.Command("docker", "ps", "-q")

	// получаем список контейнеров
	output, err := getContainersCmd.Output()
	if err != nil {
		fmt.Println(err)
		return
	}
	// делим вывод команды для списка контейнеров на строки
	containers := strings.Split(string(output), "\n")

	var containersToDrop []string
	for _, container := range containers {
		if len(container) == 0 {
			continue
		}

		//docker inspect -f '{{ .Created }}' 9e7b99e8c215
		containerCreateTimeCmd := exec.Command("docker", "inspect", "-f", "'{{ .Created }}'", container)

		result, _ := containerCreateTimeCmd.Output()

		containerCreateTime, _ := time.Parse("'2006-01-02T15:04:05", string(result[:20]))
		minimumPossibleTime := time.Now().Round(time.Minute).Add(-30 * time.Minute)

		logger.WriteToLog("Cont create Time: " + containerCreateTime.Local().String())
		logger.WriteToLog("Time when delete: " + minimumPossibleTime.String())

		if !containerCreateTime.After(minimumPossibleTime) {
			containersToDrop = append(containersToDrop, container)
		}
	}

	if len(containersToDrop) > 0 {
		dropContainers(containersToDrop)
	}
}

func dropContainers(containersToDrop []string) {

	// команда для удаления контейнеров
	cmd2 := exec.Command("docker", "rm", "-f")

	// передаем каждый контейнер в команду для удаления
	for _, container := range containersToDrop {
		if container != "" {
			cmd2.Args = append(cmd2.Args, container)
		}
	}

	// выполнение команды для удаления контейнеров
	err := cmd2.Run()
	if err != nil {
		fmt.Println(err)
		return
	}

	log.Println("[CONTAINER DISPENSER] Страые контейнеры удалены")
}
