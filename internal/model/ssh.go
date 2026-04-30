package model

// SSHConfig holds the SSH tunnel server configuration.
type SSHConfig struct {
	Enabled bool   `yaml:"enabled"`  // Enable SSH tunnel server (default: true)
	Port    int    `yaml:"port"`     // SSH port (0 = auto = main_port + 1)
	HostKey string `yaml:"host_key"` // Path to host key file (empty = auto-generate ephemeral)
}
