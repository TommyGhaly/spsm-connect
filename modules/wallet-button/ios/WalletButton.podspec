Pod::Spec.new do |s|
  s.name           = 'WalletButton'
  s.version        = '1.0.0'
  s.summary        = "Apple's own Apple Pay button, as a React Native view."
  s.license        = 'MIT'
  s.author         = 'SPSM'
  s.homepage       = 'https://spsm.org'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PassKit'

  s.static_framework = true
  s.source_files = '**/*.{h,m,swift}'
end
