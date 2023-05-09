package dispenser

import (
	"bytes"
	"fmt"
	"log"
	"os/exec"
	"strconv"
	"strings"
)

type DockerContainer struct {
	Port uint16
}

const imageName = "pea/atb:latest"

func UpDockerContainer() DockerContainer {
	dropContainer()
	var port int = 8889
	strconv.Itoa(port)
	cmd := exec.Command("docker", "run", "-d", "-p", "8889:8889", imageName)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		log.Fatal(err)
	}

	container := DockerContainer{Port: 8889}
	return container
}

func dropContainer() {
	// команда для вывода списка контейнеров
	cmd1 := exec.Command("docker", "ps", "-q")

	// получаем список контейнеров
	output, err := cmd1.Output()
	if err != nil {
		fmt.Println(err)
		return
	}

	// команда для удаления контейнеров
	cmd2 := exec.Command("docker", "rm", "-f")

	// делим вывод команды для списка контейнеров на строки
	containers := strings.Split(string(output), "\n")

	// передаем каждый контейнер в команду для удаления
	for _, container := range containers {
		if container != "" {
			cmd2.Args = append(cmd2.Args, container)
		}
	}

	// выполнение команды для удаления контейнеров
	err = cmd2.Run()
	if err != nil {
		fmt.Println(err)
		return
	}

	log.Println("[CONTAINER DISPENSER] Активные контейнеры удалены")
}
