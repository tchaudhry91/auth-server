# EXLskills Authentication Server

## Requirements

You may be able to get away with more/less than what's described below, but we can't recommend anything outside of these options:

Operating Systems:

- Ubuntu 16.04
- OS X 10.13+
- Windows has not been thoroughly tested, although it has worked and should work... Windows-related contributions are welcome

Other Dependencies:

- MongoDB v3.4+ (Recommend v3.6+)
- NodeJS v8.10+
- NPM v6.1+

## Installation

```
git clone https://github.com/exlskills/auth-server

cd auth-server

npm install
```

## Running

With MongoDB running, start the local server:

```
npm start
```

### Configuration

The process obtains required configuration information from `.env` file located in the installation root directory and / or from the OS Environment Variables.   

Copy the sample `.default.env` into `.env` and set the necessary values, e.g., for local testing, set
```
KEYCLOAK_HOST='http://localhost:8082'
```

## License

This software is offered under the terms outlined in the [LICENSE.md](LICENSE.md) file provided with this notice. If you have any questions regarding the license, please contact [licensing@exlinc.com](mailto:licensing@exlinc.com)

## Enterprise / Commercial Licensing & Support

For enterprise licenses and/or support, please send an email enquiry to [enterprise@exlinc.com](mailto:enterprise@exlinc.com)
