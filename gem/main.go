package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os/exec"
	"strings"
)

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

type PromptRequest struct {
	Prompt string `json:"prompt"`
}

type PromptResponse struct {
	Result string `json:"result"`
	Error  string `json:"error,omitempty"`
}

func handlePrompt(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var req PromptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		response := PromptResponse{Error: "Invalid JSON"}
		json.NewEncoder(w).Encode(response)
		return
	}

	if req.Prompt == "" {
		w.WriteHeader(http.StatusBadRequest)
		response := PromptResponse{Error: "Prompt cannot be empty"}
		json.NewEncoder(w).Encode(response)
		return
	}

	cmd := exec.Command("gemini", "-p", req.Prompt)
	output, err := cmd.CombinedOutput()

	result := string(output)

	// Clean up "Loaded cached credentials." prefix if present
	result, _ = strings.CutPrefix(result, "Loaded cached credentials.\n")

	// Debug: log the raw output to see what we're getting
	log.Printf("Raw output: %q", result[:min(200, len(result))])

	// Replace literal \n with actual newlines (the gemini binary outputs escaped newlines)
	result = strings.ReplaceAll(result, "\\n", "\n")
	result = strings.TrimSpace(result)

	response := PromptResponse{
		Result: result,
	}

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		response.Error = err.Error()
	}

	json.NewEncoder(w).Encode(response)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func main() {
	listenAddr := ":8080"

	log.Printf("Starting gem service on %s", listenAddr)

	http.HandleFunc("/api/prompt", handlePrompt)
	http.HandleFunc("/health", handleHealth)

	log.Fatal(http.ListenAndServe(listenAddr, nil))
}
