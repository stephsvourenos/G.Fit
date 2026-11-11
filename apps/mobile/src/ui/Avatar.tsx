import { useMemo } from "react";
import { Image, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { avatarById, stillSvg, type Profile } from "@app/domain";

/** Profile picture: an illustrated library picture ("@id", shown still on the phone) or an emoji on a colour tile. */
export function Avatar({ p, size }: { p: Pick<Profile, "avatar">; size: number }) {
  const pic = avatarById(p.avatar.emoji);
  const xml = useMemo(() => (pic ? stillSvg(pic.svg) : undefined), [pic]);
  const radius = size * 0.28;
  if (p.avatar.coach) {
    return <Image source={{ uri: p.avatar.coach.imageUrl }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#2E2A3B" }} accessibilityIgnoresInvertColors />;
  }
  if (xml) {
    return (
      <View style={{ width: size, height: size, borderRadius: radius, overflow: "hidden" }} accessibilityElementsHidden importantForAccessibility="no">
        <SvgXml xml={xml} width={size} height={size} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: p.avatar.colour, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.42 }}>{p.avatar.emoji}</Text>
    </View>
  );
}
