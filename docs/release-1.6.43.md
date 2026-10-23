# Rugare TV 1.6.43

Android version code 70.

- Added 48 free, ad-supported English channels from NeoTV+'s public worldwide catalog: 3 News (NHK World, CGTN, CGTN Global Biz), 16 Lifestyle, 9 Movies, 9 Music, 9 Entertainment and 2 Kids. Source URLs and ads are preserved, as for the existing NeoTV+ sports subset.
- Channels already carried under other names, religious channels, and feeds that failed their media probe were not imported. Arabic, Spanish and Indian NeoTV+ catalogs remain outside the English policy.
- A channel whose playlist group is already a browsing category (News, Movies, Lifestyle, Music, Entertainment, Kids) now appears under that category instead of a name-based guess. No existing channel changes category.
- Disabled Willow.us@HD after its host timed out.

Dark/light themes and the menu version are retained. The release advances from the already published immutable v1.6.42 artifact.

Verification: 117 automated tests pass and generated playlists match the registry. Each of the 50 initially imported NeoTV+ channels was played for 25 seconds in a debug build on the connected Samsung phone through Rugare's native player; all reached first frame and playing state (three needed a 45-second retest after a transient HTTP error or slow start). The two religious channels were removed afterwards.
