package main

import (
	_ "embed"
	"fmt"
	"log"
	"os"
	"strings"
	"text/template"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

//go:embed nginx.tmpl
var nginxTemplate string

//go:embed docker-compose.tmpl
var dockerComposeTemplate string

type Config struct {
	Projects map[string]Project `yaml:"projects"`
}

type Project struct {
	Port           int               `yaml:"port"`
	Protected      bool              `yaml:"protected"`
	Environment    map[string]string `yaml:"environment"`
	Allowlist      []string          `yaml:"allowlist"`
	TrustedProxies []string          `yaml:"trusted_proxies"`
	Ports          []string          `yaml:"ports,omitempty"`
	Volumes        []string          `yaml:"volumes,omitempty"`
}

type ServiceData struct {
	Name           string
	Port           int
	Environment    map[string]string
	Allowlist      []string
	TrustedProxies []string
	Ports          []string
	Volumes        []string
}

type TemplateData struct {
	Domain       string
	Protected    []ServiceData
	Unprotected  []ServiceData
	AllServices  []ServiceData
	FirstProject string
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run main.go <projects.yaml>")
	}

	// Load .env file (ignore error if file doesn't exist)
	godotenv.Load("../.env")

	domain := getEnv("DALE_DOMAIN", "lvh.me")

	// Read config
	config := readConfig(os.Args[1])

	// Prepare template data
	data := prepareTemplateData(config, domain)

	// Generate files using embedded templates
	if err := generate("docker-compose", dockerComposeTemplate, "../docker-compose.yml", data); err != nil {
		log.Fatal("Error generating docker-compose.yml:", err)
	}

	if err := generate("nginx", nginxTemplate, "nginx/default.conf", data); err != nil {
		log.Fatal("Error generating nginx config:", err)
	}

	fmt.Printf("✅ Generated configuration for %d projects\n", len(config.Projects))
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func readConfig(file string) Config {
	data, err := os.ReadFile(file)
	if err != nil {
		log.Fatal(err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		log.Fatal(err)
	}
	return config
}

func prepareTemplateData(config Config, domain string) TemplateData {
	var protected, unprotected, allServices []ServiceData
	var firstProject string

	for name, project := range config.Projects {
		service := ServiceData{
			Name:           name,
			Port:           project.Port,
			Environment:    project.Environment,
			Allowlist:      project.Allowlist,
			TrustedProxies: project.TrustedProxies,
			Ports:          project.Ports,
			Volumes:        project.Volumes,
		}

		allServices = append(allServices, service)

		if project.Protected {
			protected = append(protected, service)
		} else {
			unprotected = append(unprotected, service)
		}

		if firstProject == "" {
			firstProject = name
		}
	}

	return TemplateData{
		Domain:       domain,
		Protected:    protected,
		Unprotected:  unprotected,
		AllServices:  allServices,
		FirstProject: firstProject,
	}
}

func generate(name, templateContent, outputFile string, data TemplateData) error {
	os.MkdirAll("nginx", 0755)

	file, err := os.Create(outputFile)
	if err != nil {
		return err
	}
	defer file.Close()

	tmpl := template.Must(template.New(name).Funcs(template.FuncMap{"ToUpper": strings.ToUpper}).Parse(templateContent))
	if err := tmpl.Execute(file, data); err != nil {
		return err
	}

	// If generating docker-compose, append infrastructure files
	if name == "docker-compose" {
		return appendInfrastructure(file)
	}

	return nil
}

func appendInfrastructure(file *os.File) error {
	// Services
	if data, err := os.ReadFile("infra/services.yaml"); err == nil {
		file.WriteString("\n  # Infrastructure services\n")
		for _, line := range strings.Split(string(data), "\n") {
			if strings.TrimSpace(line) != "" {
				file.WriteString("  " + line + "\n")
			}
		}
	}

	// Volumes
	if data, err := os.ReadFile("infra/volumes.yaml"); err == nil {
		file.WriteString("\nvolumes:\n")
		for _, line := range strings.Split(string(data), "\n") {
			if strings.TrimSpace(line) != "" {
				file.WriteString("  " + line + "\n")
			}
		}
	}

	return nil
}
