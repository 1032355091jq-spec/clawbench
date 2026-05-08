package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"clawbench/internal/model"
	"clawbench/internal/terminal"
)

func TestTerminalConfigRouteRequiresAuth(t *testing.T) {
	origToken := model.SessionToken
	origMgr := terminalMgr
	t.Cleanup(func() {
		model.SessionToken = origToken
		terminalMgr = origMgr
	})

	model.SessionToken = "test-token"
	SetTerminalManager(nil)

	mux := http.NewServeMux()
	RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/terminal/config", nil)
	req.RemoteAddr = "203.0.113.10:12345"
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected terminal config to require auth, got status %d body %s", w.Code, w.Body.String())
	}
}

func TestTerminalWebSocketRejectsInvalidCwdBeforeUpgrade(t *testing.T) {
	origMgr := terminalMgr
	t.Cleanup(func() {
		if terminalMgr != nil && terminalMgr != origMgr {
			terminalMgr.Close()
		}
		terminalMgr = origMgr
	})

	projectDir := t.TempDir()
	SetTerminalManager(terminal.NewManager(model.TerminalConfig{
		Enabled:      true,
		IdleTimeout:  "1m",
		BufferLines:  100,
		MaxLineBytes: 65536,
		MaxBufferMB:  4,
	}, 20000))

	req := httptest.NewRequest(http.MethodGet, "/api/terminal/ws?cwd=../../etc", nil)
	withProjectCookie(req, projectDir)
	w := callHandler(TerminalWebSocket, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected invalid cwd to be rejected before websocket upgrade, got status %d body %s", w.Code, w.Body.String())
	}
}
