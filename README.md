# websocket_proxy

## Infrastructure

### updating servers
There are gitlab-ci jobs to update each server individually.

### adding new servers
- create the needed values (private key, public key and node id)
- add them to the inventory.yaml (vault password in gitlab ci vars)
  - `ansible-vault edit infra/inventory.yaml` https://docs.ansible.com/ansible/latest/cli/ansible-vault.html
- ensure ssh access to the servers is allowed (and the ports are open)
  - steps needed in gcp
    - set root password `sudo passwd`
    - vim /etc/ssh/sshd_config
      ```
        # set
        PermitRootLogin yes
        PasswordAuthentication yes
        ```
    - `service ssh restart`
    - ensure ports 50000 and 9001 are open
    - set static ip
    
