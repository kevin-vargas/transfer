.PHONY: generate run build clean

# Generate configuration files
generate:
	cd dale && go run main.go ../projects.yaml

# Build and run all services
run: generate
	docker compose up --build -d

# Build services without running
build: generate
	docker compose build

# Stop and clean up
clean:
	docker compose down
	docker compose rm -f