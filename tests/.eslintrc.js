module.exports = {
  env: {
    mocha: true
  },
  plugins: [
    'mocha'
  ],
  extends: ['plugin:mocha/recommended'],
  overrides: [
    {
      env: {
        mocha: true
      },
      files: ['*.js', '*.ts'],
      parserOptions: {
        project: './tests/tsconfig.json'
      }
    }
  ]
}
