#!/bin/bash
# Installation script for Wellbeing Widget GNOME Extension

set -e

EXTENSION_UUID="screentime@mehedi.io"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🌿 Wellbeing Widget Installer"
echo "=============================="
echo ""

# Check GNOME Shell version
GNOME_VERSION=$(gnome-shell --version | grep -oP '\d+' | head -1)
if [ "$GNOME_VERSION" -lt 49 ]; then
    echo "❌ Error: This extension requires GNOME 49 or higher."
    echo "   Your version: $GNOME_VERSION"
    exit 1
fi
echo "✓ GNOME Shell version: $GNOME_VERSION"

# Create extension directory
echo "📁 Creating extension directory..."
mkdir -p "$EXTENSION_DIR"

# Copy files
echo "📋 Copying extension files..."
cp -r "$SCRIPT_DIR"/* "$EXTENSION_DIR/"

# Remove unnecessary files from extension directory
echo "🧹 Cleaning up..."
cd "$EXTENSION_DIR"
rm -f install.sh GITHUB_SETUP.md .git* .gitignore

# Compile schemas
echo "⚙️  Compiling GSettings schemas..."
if [ -d "$EXTENSION_DIR/schemas" ]; then
    glib-compile-schemas "$EXTENSION_DIR/schemas/"
    echo "✓ Schemas compiled successfully"
else
    echo "⚠️  Warning: No schemas directory found"
fi

# Set proper permissions
echo "🔒 Setting permissions..."
chmod +x "$EXTENSION_DIR"/*.js 2>/dev/null || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Clear GNOME Shell cache:"
echo "   rm -rf ~/.cache/gnome-shell/*"
echo ""
echo "2. Log out and log back in (required for Wayland)"
echo "   Or restart GNOME Shell on X11: Alt+F2, type 'r', press Enter"
echo ""
echo "3. Enable the extension:"
echo "   gnome-extensions enable $EXTENSION_UUID"
echo ""
echo "4. Verify installation:"
echo "   gnome-extensions info $EXTENSION_UUID"
echo ""
echo "🌿 Enjoy mindful computing!"
