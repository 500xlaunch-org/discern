# Put Discern's notification service (ios-extension/NotificationService) into
# the generated iPhone project: its own target, embedded in the app, signed for
# the App Store with its own profile. Run after `cap add ios` / tools/native.py;
# running it again changes nothing.
#
#   ruby tools/ios-nse.rb [team-id] [profile-name]
require "xcodeproj"
require "fileutils"

root = File.expand_path("..", __dir__)
team = ARGV[0] || ENV["APPLE_TEAM_ID"] || "8A22QTA6TM"
profile = ARGV[1] || ENV["IOS_NSE_PROFILE"] || "Discern Notification Service App Store"
name = "NotificationService"
bundle = "com.xurface.discern.app.NotificationService"

project_path = File.join(root, "ios", "App", "App.xcodeproj")
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |t| t.name == "App" } or abort "no App target"

dir = File.join(root, "ios", "App", name)
FileUtils.mkdir_p(dir)
%w[NotificationService.swift Info.plist].each { |f| FileUtils.cp(File.join(root, "ios-extension", name, f), File.join(dir, f)) }

if project.targets.any? { |t| t.name == name }
  puts "  #{name}: already in the project"
  exit 0
end

ext = project.new_target(:app_extension, name, :ios, "15.0")
group = project.main_group.find_subpath(name, true)
group.set_source_tree("<group>"); group.set_path(name)
swift = group.new_reference("NotificationService.swift")
group.new_reference("Info.plist")
ext.add_file_references([swift])

ext.build_configurations.each do |c|
  s = c.build_settings
  s["PRODUCT_BUNDLE_IDENTIFIER"] = bundle
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["INFOPLIST_FILE"] = "#{name}/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["SWIFT_VERSION"] = "5.0"
  s["TARGETED_DEVICE_FAMILY"] = "1,2"
  s["IPHONEOS_DEPLOYMENT_TARGET"] = "15.0"
  s["DEVELOPMENT_TEAM"] = team
  s["SKIP_INSTALL"] = "YES"
  s["APPLICATION_EXTENSION_API_ONLY"] = "YES"
  if c.name == "Release"
    s["CODE_SIGN_STYLE"] = "Manual"
    s["CODE_SIGN_IDENTITY"] = "Apple Distribution"
    s["PROVISIONING_PROFILE_SPECIFIER"] = profile
  else
    s["CODE_SIGN_STYLE"] = "Automatic"
  end
end

# the app carries it: build it first, then copy it into PlugIns
app.add_dependency(ext)
embed = app.copy_files_build_phases.find { |p| p.name == "Embed Foundation Extensions" } ||
        app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference, true)
bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "  #{name}: added, embedded in the app, signed with \"#{profile}\" for release"
